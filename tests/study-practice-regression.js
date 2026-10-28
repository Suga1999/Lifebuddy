/*
 * No-framework regression test for Study Space practice selection and progress.
 * Run with: node tests/study-practice-regression.js
 */
const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(os.tmpdir(), `lifebuddy-study-regression-${process.pid}.db`);
const port = 38000 + (process.pid % 1000);
const secret = 'study-regression-secret-that-is-longer-than-thirty-two-characters';
const base = `http://127.0.0.1:${port}`;

async function waitForHealth() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${base}/health`);
            if (response.ok && (await response.json()).database === 'ready') return;
        } catch { /* Server is still booting. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy in time');
}

async function api(endpoint, token, body, method) {
    const response = await fetch(`${base}${endpoint}`, {
        method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    assert.equal(response.ok, true, `${endpoint}: ${JSON.stringify(data)}`);
    return data;
}

async function main() {
    await fs.rm(databasePath, { force: true });
    const server = spawn(process.execPath, ['server.js'], {
        cwd: projectRoot,
        env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, JWT_SECRET: secret },
        stdio: 'pipe'
    });
    let output = '';
    server.stdout.on('data', (chunk) => { output += chunk; });
    server.stderr.on('data', (chunk) => { output += chunk; });
    try {
        await waitForHealth();
        const { token } = await api('/api/auth/register', null, { email: 'study-test@example.test', password: 'Testpass123!', name: 'Study test' });
        const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
        const imported = await api('/api/word-lists/import', token, { title: 'Test', entries: words.map((term) => ({ term, definition: `${term}-def` })) });
        const listId = imported.list.id;

        // Answer every word once: "alpha" and "bravo" wrongly, the rest correctly, each in a full-list session.
        const first = await api(`/api/word-lists/${listId}/practice/start`, token, { method: 'test', direction: 'term_definition', selection: { mode: 'all', count: 'all' } });
        let question = first.question;
        let completed = false;
        while (!completed) {
            const term = question.prompt;
            const wrong = term === 'alpha' || term === 'bravo';
            const result = await api(`/api/word-lists/${listId}/practice/submit`, token, { sessionId: first.session.id, entryId: question.entryId, answer: wrong ? 'zzz' : `${term}-def` });
            assert.equal(result.correct, !wrong);
            completed = result.completed;
            question = result.nextQuestion;
        }

        const progress = await api(`/api/word-lists/${listId}/progress`, token);
        assert.equal(progress.summary.difficult, 2, 'two wrongly answered words are difficult');
        assert.equal(progress.summary.practiced, 8);

        // A short "all words" session must prefer the difficult words over well-known ones.
        // Each round keeps answering alpha/bravo wrongly so they stay difficult.
        for (let attempt = 0; attempt < 15; attempt++) {
            const short = await api(`/api/word-lists/${listId}/practice/start`, token, { method: 'test', direction: 'term_definition', selection: { mode: 'all', count: 3 } });
            let q = short.question, done = false;
            const selected = [];
            while (!done) {
                selected.push(q.prompt);
                const wrong = q.prompt === 'alpha' || q.prompt === 'bravo';
                const r = await api(`/api/word-lists/${listId}/practice/submit`, token, { sessionId: short.session.id, entryId: q.entryId, answer: wrong ? 'zzz' : `${q.prompt}-def` });
                done = r.completed; q = r.nextQuestion;
            }
            assert.equal(selected.length, 3);
            assert.ok(selected.includes('alpha') && selected.includes('bravo'), `difficult words must be selected first, got ${selected.join(', ')}`);
        }

        // Selecting specific words and the difficult-only mode keep working.
        const onlyDifficult = await api(`/api/word-lists/${listId}/practice/start`, token, { method: 'flashcards', direction: 'term_definition', selection: { mode: 'difficult', count: 'all' } });
        assert.equal(onlyDifficult.session.total, 2);
        // Automatic session length: up to 20 words everything, above that half of the words.
        const sizes = { 1: 1, 8: 8, 20: 20, 21: 11, 30: 15, 41: 21 };
        for (const [count, expected] of Object.entries(sizes)) {
            const entries = Array.from({ length: Number(count) }, (_, index) => ({ term: `woord${count}-${index}`, definition: `betekenis${index}` }));
            const imported = await api('/api/word-lists/import', token, { title: `Lijst van ${count}`, entries });
            const started = await api(`/api/word-lists/${imported.list.id}/practice/start`, token, { method: 'test', direction: 'term_definition', selection: { mode: 'all', count: 'auto' } });
            assert.equal(started.session.total, expected, `${count} words must give ${expected} questions`);
        }
        const defaulted = await api('/api/word-lists/' + (await api('/api/word-lists/import', token, { title: 'Zonder keuze', entries: Array.from({ length: 12 }, (_, index) => ({ term: `t${index}`, definition: `d${index}` })) })).list.id + '/practice/start', token, { method: 'test', direction: 'term_definition' });
        assert.equal(defaulted.session.total, 12, 'no selection at all also means automatic');
        console.log('Study practice regression: PASS');
    } finally {
        server.kill();
        await fs.rm(databasePath, { force: true }).catch(() => {});
        if (output.includes('❌')) console.error(output.trim());
    }
}

main().catch((error) => {
    console.error(`Study practice regression: FAIL\n${error.stack || error.message}`);
    process.exitCode = 1;
});
