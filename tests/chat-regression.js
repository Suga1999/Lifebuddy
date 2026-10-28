/*
 * No-framework regression test for the AI Buddy chat backend.
 * Uses a fake Ollama server, so it needs neither Ollama nor a downloaded model.
 * Run with: node tests/chat-regression.js
 */
const assert = require('assert/strict');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(os.tmpdir(), `lifebuddy-chat-regression-${process.pid}.db`);
const port = 39000 + (process.pid % 900);
const fakeOllamaPort = 40000 + (process.pid % 900);
const base = `http://127.0.0.1:${port}`;
const ANSWER = ['Dit ', 'is ', 'een ', '**antwoord**.'];

let ollamaMessages = [];
const fakeOllama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
        ollamaMessages = JSON.parse(body).messages;
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        ANSWER.forEach((text) => res.write(`${JSON.stringify({ message: { role: 'assistant', content: text }, done: false })}\n`));
        res.end(`${JSON.stringify({ message: { role: 'assistant', content: '' }, done: true })}\n`);
    });
});

async function waitForHealth() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try { const response = await fetch(`${base}/health`); if (response.ok && (await response.json()).database === 'ready') return; } catch { /* booting */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy in time');
}

async function stream(token, message) {
    const response = await fetch(`${base}/api/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message }) });
    assert.equal(response.ok, true);
    const events = (await response.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line));
    return events;
}
async function history(token) {
    const response = await fetch(`${base}/api/chat/history`, { headers: { Authorization: `Bearer ${token}` } });
    return (await response.json()).history;
}

async function startServer(env) {
    const server = spawn(process.execPath, ['server.js'], { cwd: projectRoot, env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, JWT_SECRET: 'chat-regression-secret-that-is-longer-than-thirty-two-characters', ...env }, stdio: 'pipe' });
    await waitForHealth();
    return server;
}

async function main() {
    await fs.rm(databasePath, { force: true });
    await new Promise((resolve) => fakeOllama.listen(fakeOllamaPort, '127.0.0.1', resolve));
    let server = await startServer({ OLLAMA_BASE_URL: `http://127.0.0.1:${fakeOllamaPort}` });
    try {
        const register = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'chat-test@example.test', password: 'Testpass123!', name: 'Chat test' }) });
        const { token } = await register.json();

        // 1. Streaming: chunks arrive as deltas, a done event closes the stream, the stored answer equals the streamed text.
        const events = await stream(token, 'Hoi buddy');
        assert.deepEqual(events.filter((event) => event.type === 'delta').map((event) => event.text), ANSWER);
        assert.equal(events.at(-1).type, 'done');
        let stored = await history(token);
        assert.deepEqual(stored.map((entry) => entry.role), ['user', 'assistant']);
        assert.equal(stored[1].message, ANSWER.join(''));

        // 2. Old connection errors that were stored as assistant replies never reach the model as context.
        await fetch(`${base}/api/chat`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        const sqlite = require('node:sqlite');
        server.kill(); await new Promise((resolve) => setTimeout(resolve, 300));
        const db = new sqlite.DatabaseSync(databasePath);
        const userId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
        db.prepare("INSERT INTO chat_history (id, user_id, message, role) VALUES ('legacy-error', ?, 'Ik kan Ollama lokaal nu niet bereiken. Start Ollama.', 'assistant')").run(userId);
        db.close();
        server = await startServer({ OLLAMA_BASE_URL: `http://127.0.0.1:${fakeOllamaPort}` });
        await stream(token, 'Tweede vraag');
        assert.equal(ollamaMessages.some((entry) => String(entry.content).startsWith('Ik kan Ollama lokaal nu niet bereiken')), false, 'legacy error text must not be sent to the model');

        // 3. Ollama down: an error event is returned, no assistant message is stored, and a retry does not duplicate the user message.
        server.kill(); await new Promise((resolve) => setTimeout(resolve, 300));
        server = await startServer({ OLLAMA_BASE_URL: 'http://127.0.0.1:9' });
        const before = (await history(token)).length;
        const failed = await stream(token, 'Derde vraag');
        assert.equal(failed.at(-1).type, 'error');
        assert.equal(failed.at(-1).code, 'unreachable');
        const retry = await stream(token, 'Derde vraag');
        assert.equal(retry.at(-1).type, 'error');
        stored = await history(token);
        assert.equal(stored.length, before + 1, 'only one user message is stored for a retried failed question');
        assert.equal(stored.at(-1).role, 'user');
        console.log('Chat regression: PASS');
    } finally {
        server.kill();
        fakeOllama.close();
        await fs.rm(databasePath, { force: true }).catch(() => {});
    }
}

main().catch((error) => { console.error(`Chat regression: FAIL\n${error.stack || error.message}`); process.exitCode = 1; });
