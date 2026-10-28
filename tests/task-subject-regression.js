/*
 * Regression test: subjects keep a fixed colour, and a task can be linked to one of the user's own subjects.
 * Run with: node tests/task-subject-regression.js
 */
const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(os.tmpdir(), `lifebuddy-tasks-regression-${process.pid}.db`);
const port = 41000 + (process.pid % 900);
const base = `http://127.0.0.1:${port}`;

async function waitForHealth() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try { const response = await fetch(`${base}/health`); if (response.ok && (await response.json()).database === 'ready') return; } catch { /* booting */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy in time');
}
async function api(endpoint, token, body, method) {
    const response = await fetch(`${base}${endpoint}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert.equal(response.ok, true, `${endpoint}: ${JSON.stringify(data)}`);
    return data;
}
async function register(email) {
    return (await api('/api/auth/register', null, { email, password: 'Testpass123!', name: email.split('@')[0] })).token;
}

async function main() {
    await fs.rm(databasePath, { force: true });
    const server = spawn(process.execPath, ['server.js'], { cwd: projectRoot, env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, JWT_SECRET: 'tasks-regression-secret-that-is-longer-than-thirty-two-characters' }, stdio: 'pipe' });
    try {
        await waitForHealth();
        const token = await register('tasks-a@example.test');
        const other = await register('tasks-b@example.test');

        // Each new subject gets the next free colour (0..5), and keeps it.
        for (const name of ['Wiskunde B', 'Nederlands', 'Engels']) await api('/api/subjects', token, { name, grades: [{ label: 'Toets', grade: 7, weight: 1, period: 'V1' }] });
        const subjects = await api('/api/subjects', token);
        assert.deepEqual(subjects.map((subject) => subject.color).sort(), [0, 1, 2]);
        const colours = Object.fromEntries(subjects.map((subject) => [subject.name, subject.color]));
        await api('/api/subjects', token, { name: 'Frans', grades: [{ label: 'Toets', grade: 6, weight: 1, period: 'V1' }] });
        const again = await api('/api/subjects', token);
        assert.equal(again.find((subject) => subject.name === 'Wiskunde B').color, colours['Wiskunde B'], 'existing colours never change');
        assert.equal(again.find((subject) => subject.name === 'Frans').color, 3);

        // A task can be linked to one of the user's own subjects.
        const wiskunde = again.find((subject) => subject.name === 'Wiskunde B');
        await api('/api/tasks', token, { title: 'Oefentoets hoofdstuk 7', due_date: '2026-10-09', subject_id: wiskunde.id });
        let tasks = await api('/api/tasks', token);
        assert.equal(tasks[0].subject_id, wiskunde.id);

        // Updating without subject_id keeps the link, null removes it.
        await api(`/api/tasks/${tasks[0].id}`, token, { title: 'Oefentoets hoofdstuk 7', description: '', due_date: '2026-10-09', status: 'completed' }, 'PUT');
        tasks = await api('/api/tasks', token);
        assert.equal(tasks[0].subject_id, wiskunde.id);
        assert.equal(tasks[0].status, 'completed');
        await api(`/api/tasks/${tasks[0].id}`, token, { title: 'Oefentoets hoofdstuk 7', description: '', due_date: '2026-10-09', status: 'pending', subject_id: null }, 'PUT');
        tasks = await api('/api/tasks', token);
        assert.equal(tasks[0].subject_id, null);

        // Another user's subject can never be linked.
        await api('/api/tasks', other, { title: 'Taak van iemand anders', subject_id: wiskunde.id });
        const otherTasks = await api('/api/tasks', other);
        assert.equal(otherTasks[0].subject_id, null, 'a subject of another user is ignored');
        console.log('Task subject regression: PASS');
    } finally {
        server.kill();
        await fs.rm(databasePath, { force: true }).catch(() => {});
    }
}
main().catch((error) => { console.error(`Task subject regression: FAIL\n${error.stack || error.message}`); process.exitCode = 1; });
