/*
 * No-framework regression test for the grade-entry migration.
 * Run with: node tests/grade-entry-regression.js
 */
const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(os.tmpdir(), `lifebuddy-grade-regression-${process.pid}.db`);
const port = 39000 + (process.pid % 1000);
const secret = 'grade-regression-secret-that-is-longer-than-thirty-two-characters';
const userId = 'grade-regression-user';

function run(db, sql, parameters = []) {
    return new Promise((resolve, reject) => db.run(sql, parameters, (error) => (error ? reject(error) : resolve())));
}

async function seedLegacyDatabase() {
    const db = new sqlite3.Database(databasePath);
    try {
        await run(db, `CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT,
            plan TEXT DEFAULT 'free', streak INTEGER NOT NULL DEFAULT 0, last_study_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await run(db, 'CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, grade REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
        // This intentionally models the old production constraint that prevented repeat labels across periods.
        await run(db, `CREATE TABLE grade_entries (
            id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, user_id TEXT NOT NULL, label TEXT NOT NULL,
            grade REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(subject_id, label)
        )`);
        await run(db, 'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)', [userId, 'grade-test@example.test', 'not-used', 'Grade test']);
        await run(db, 'INSERT INTO subjects (id, user_id, name, grade) VALUES (?, ?, ?, ?)', ['legacy-subject', userId, 'Wiskunde', 6.5]);
        await run(db, 'INSERT INTO grade_entries (id, subject_id, user_id, label, grade) VALUES (?, ?, ?, ?, ?)', ['legacy-entry', 'legacy-subject', userId, 'Toets 1', 6.5]);
    } finally {
        await new Promise((resolve) => db.close(resolve));
    }
}

async function waitForHealth() {
    const endpoint = `http://127.0.0.1:${port}/health`;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(endpoint);
            if (response.ok && (await response.json()).database === 'ready') return;
        } catch { /* Server is still booting. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy in time');
}

async function request(endpoint, options = {}) {
    const token = jwt.sign({ id: userId, email: 'grade-test@example.test', plan: 'free' }, secret, { expiresIn: '5m' });
    const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const body = await response.json();
    assert.equal(response.ok, true, `${endpoint}: ${JSON.stringify(body)}`);
    return body;
}

async function main() {
    await fs.rm(databasePath, { force: true });
    await seedLegacyDatabase();
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
        await request('/api/subjects', {
            method: 'POST',
            body: JSON.stringify({ name: 'Wiskunde', grades: [
                { label: 'Toets 1', period: 'V5', grade: 7.0 },
                { label: 'Toets 1', period: 'V6', grade: 8.0 }
            ] })
        });

        let subjects = await request('/api/subjects');
        let grades = subjects.find((subject) => subject.name === 'Wiskunde').grades.filter((grade) => grade.label === 'Toets 1');
        assert.deepEqual(grades.map((grade) => grade.period).sort(), ['Algemeen', 'V5', 'V6']);

        await request('/api/subjects', {
            method: 'POST',
            body: JSON.stringify({ name: 'Wiskunde', grades: [{ label: 'Toets 1', period: 'V5', grade: 9.0 }] })
        });
        subjects = await request('/api/subjects');
        grades = subjects.find((subject) => subject.name === 'Wiskunde').grades.filter((grade) => grade.label === 'Toets 1');
        assert.equal(grades.length, 3, 'upserting V5 must not duplicate or overwrite V6/legacy grades');
        assert.equal(grades.find((grade) => grade.period === 'V5').grade, 9);
        assert.equal(grades.find((grade) => grade.period === 'V6').grade, 8);
        assert.equal(grades.find((grade) => grade.period === 'Algemeen').grade, 6.5);

        // Dates and weights survive an import, a re-import updates in place, and an invalid date never wipes a saved one.
        await request('/api/subjects/import', {
            method: 'POST',
            body: JSON.stringify({ subjects: [{ name: 'Scheikunde', grades: [{ label: 'Practicum', period: 'V4', grade: 7.5, weight: 2, date: '2026-10-02' }] }] })
        });
        await request('/api/subjects/import', {
            method: 'POST',
            body: JSON.stringify({ subjects: [{ name: 'Scheikunde', grades: [{ label: 'Practicum', period: 'V4', grade: 8.0, weight: 2, date: '2026-31-02' }] }] })
        });
        subjects = await request('/api/subjects');
        const practicum = subjects.find((subject) => subject.name === 'Scheikunde').grades;
        assert.equal(practicum.length, 1, 're-import must update, not duplicate');
        assert.equal(practicum[0].grade, 8);
        assert.equal(practicum[0].weight, 2);
        assert.equal(practicum[0].date, '2026-10-02', 'invalid date must not overwrite the stored date');

        // Removing a single grade recalculates the cached subject average.
        await request(`/api/grade-entries/${practicum[0].id}`, { method: 'DELETE' });
        subjects = await request('/api/subjects');
        assert.equal(subjects.find((subject) => subject.name === 'Scheikunde').grades.length, 0);
        console.log('Grade-entry migration regression: PASS');
    } finally {
        server.kill();
        await fs.rm(databasePath, { force: true }).catch(() => {});
        if (output.includes('❌')) console.error(output.trim());
    }
}

main().catch((error) => {
    console.error(`Grade-entry migration regression: FAIL\n${error.stack || error.message}`);
    process.exitCode = 1;
});
