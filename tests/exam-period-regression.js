/*
 * Regression test: school periods and tests (toetsen).
 * Run with: node tests/exam-period-regression.js
 */
const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(os.tmpdir(), `lifebuddy-exams-regression-${process.pid}.db`);
const port = 42000 + (process.pid % 900);
const base = `http://127.0.0.1:${port}`;

async function waitForHealth() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try { const response = await fetch(`${base}/health`); if (response.ok && (await response.json()).database === 'ready') return; } catch { /* booting */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy in time');
}
async function call(endpoint, token, body, method) {
    const response = await fetch(`${base}${endpoint}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
}
async function ok(endpoint, token, body, method) {
    const result = await call(endpoint, token, body, method);
    assert.ok(result.status < 300, `${endpoint}: ${result.status} ${JSON.stringify(result.data)}`);
    return result.data;
}
const register = async (email) => (await ok('/api/auth/register', null, { email, password: 'Testpass123!', name: email.split('@')[0] })).token;

async function main() {
    await fs.rm(databasePath, { force: true });
    const server = spawn(process.execPath, ['server.js'], { cwd: projectRoot, env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, JWT_SECRET: 'exams-regression-secret-that-is-longer-than-thirty-two-characters' }, stdio: 'pipe' });
    try {
        await waitForHealth();
        const token = await register('exams-a@example.test');
        const other = await register('exams-b@example.test');
        await ok('/api/subjects', token, { name: 'Wiskunde B', grades: [{ label: 'Toets', grade: 7, weight: 1, period: 'V4' }] });
        await ok('/api/subjects', other, { name: 'Frans', grades: [{ label: 'Toets', grade: 6, weight: 1, period: 'V4' }] });
        const wiskunde = (await ok('/api/subjects', token))[0];
        const frans = (await ok('/api/subjects', other))[0];

        // Periods: valid, invalid dates, end before start, duplicate name, overlap.
        const v4 = await ok('/api/periods', token, { name: 'V4', start_date: '2026-09-01', end_date: '2026-11-06' });
        assert.equal(v4.name, 'V4');
        for (const bad of [{ name: '', start_date: '2026-09-01', end_date: '2026-10-01' }, { name: 'X', start_date: '2026-02-31', end_date: '2026-10-01' }, { name: 'X', start_date: '2026-09-01' }, { name: 'X', start_date: '2026-10-05', end_date: '2026-10-01' }]) {
            assert.equal((await call('/api/periods', token, bad)).status, 400, JSON.stringify(bad));
        }
        assert.equal((await call('/api/periods', token, { name: 'v4', start_date: '2027-01-01', end_date: '2027-02-01' })).status, 409, 'duplicate name (case-insensitive)');
        assert.equal((await call('/api/periods', token, { name: 'V5', start_date: '2026-11-01', end_date: '2026-12-20' })).status, 409, 'overlap');
        const v5 = await ok('/api/periods', token, { name: 'V5', start_date: '2026-11-09', end_date: '2027-01-22' });
        assert.deepEqual((await ok('/api/periods', token)).map((p) => p.name), ['V4', 'V5']);
        assert.deepEqual(await ok('/api/periods', other), [], 'periods are private');
        await ok(`/api/periods/${v5.id}`, token, { name: 'V5', start_date: '2026-11-09', end_date: '2027-01-29' }, 'PUT');
        assert.equal((await call(`/api/periods/${v5.id}`, token, { name: 'V4', start_date: '2026-11-09', end_date: '2027-01-29' }, 'PUT')).status, 409);

        // Tests: needs an own subject, a title and a real date; period is derived from the date.
        const test = await ok('/api/tests', token, { subject_id: wiskunde.id, title: 'Hoofdstuk 7 toets', test_date: '2026-10-12' });
        assert.equal(test.period, 'V4');
        assert.equal((await call('/api/tests', token, { subject_id: frans.id, title: 'Niet van mij', test_date: '2026-10-12' })).status, 400, 'subject of another user');
        assert.equal((await call('/api/tests', token, { subject_id: wiskunde.id, title: 'Slechte datum', test_date: '2026-13-40' })).status, 400);
        assert.equal((await call('/api/tests', token, { subject_id: wiskunde.id, title: '  ', test_date: '2026-10-12' })).status, 400);
        assert.equal((await call('/api/tests', token, { subject_id: wiskunde.id, title: 'hoofdstuk 7 TOETS', test_date: '2026-10-12' })).status, 409, 'duplicate test');
        const buiten = await ok('/api/tests', token, { subject_id: wiskunde.id, title: 'Tijdens vakantie', test_date: '2026-12-31' });
        assert.equal(buiten.period, 'V5');
        const zonder = await ok('/api/tests', token, { subject_id: wiskunde.id, title: 'Ver weg', test_date: '2027-06-01' });
        assert.equal(zonder.period, null, 'a date outside every period has no period');
        const moved = await ok(`/api/tests/${test.id}`, token, { subject_id: wiskunde.id, title: 'Hoofdstuk 7 toets', test_date: '2026-11-10' }, 'PUT');
        assert.equal(moved.period, 'V5', 'the period follows the date');
        assert.deepEqual(await ok('/api/tests', other), [], 'tests are private');
        assert.equal((await call(`/api/tests/${test.id}`, other, null, 'DELETE')).status, 404);

        // Preparation tasks are linked, but never turn into tests on their own.
        const before = (await ok('/api/tests', token)).length;
        await ok('/api/tasks', token, { title: 'Oefentoets maken', due_date: '2026-11-08', subject_id: wiskunde.id, test_id: test.id });
        await ok('/api/tasks', other, { title: 'Probeert andermans toets', test_id: test.id });
        assert.equal((await ok('/api/tasks', other))[0].test_id, null, 'a test of another user is ignored');
        let listed = (await ok('/api/tests', token)).find((item) => item.id === test.id);
        assert.equal(listed.prep_total, 1);
        assert.equal(listed.prep_open, 1);
        assert.equal((await ok('/api/tests', token)).length, before, 'tasks do not create tests');

        // Deleting a test keeps its tasks; deleting a subject removes its tests and unlinks tasks; grades survive a test delete.
        await ok(`/api/tests/${buiten.id}`, token, null, 'DELETE');
        await ok('/api/subjects', token, { name: 'Engels', grades: [{ label: 'Toets', grade: 8, weight: 1, period: 'V4' }] });
        const engels = (await ok('/api/subjects', token)).find((subject) => subject.name === 'Engels');
        const engelsTest = await ok('/api/tests', token, { subject_id: engels.id, title: 'Writing', test_date: '2026-10-20' });
        await ok('/api/tasks', token, { title: 'Brief schrijven', subject_id: engels.id, test_id: engelsTest.id });
        await ok(`/api/subjects/${engels.id}`, token, null, 'DELETE');
        assert.equal((await ok('/api/tests', token)).some((item) => item.id === engelsTest.id), false, 'tests of a deleted subject are removed');
        const brief = (await ok('/api/tasks', token)).find((task) => task.title === 'Brief schrijven');
        assert.ok(brief, 'the task itself stays');
        assert.equal(brief.subject_id, null); assert.equal(brief.test_id, null);
        await ok(`/api/tests/${test.id}`, token, null, 'DELETE');
        assert.equal((await ok('/api/tasks', token)).find((task) => task.title === 'Oefentoets maken').test_id, null);
        assert.equal((await ok('/api/subjects', token)).find((subject) => subject.name === 'Wiskunde B').grades.length, 1, 'grades are untouched');
        console.log('Exam and period regression: PASS');
    } finally {
        server.kill();
        await fs.rm(databasePath, { force: true }).catch(() => {});
    }
}
main().catch((error) => { console.error(`Exam and period regression: FAIL\n${error.stack || error.message}`); process.exitCode = 1; });
