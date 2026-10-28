const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const configuredJwtSecret = String(process.env.JWT_SECRET || '').trim();
const looksLikePlaceholderSecret = /^(change|replace|vervang|example|secret|jwt_secret)/i.test(configuredJwtSecret);
if (IS_PRODUCTION && (!configuredJwtSecret || configuredJwtSecret.length < 32 || looksLikePlaceholderSecret)) {
    throw new Error('JWT_SECRET must be a unique, non-placeholder value of at least 32 characters in production.');
}
if (!configuredJwtSecret) {
    // Local development remains easy to start, while every restart uses a fresh non-guessable key.
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
    console.warn('⚠️ JWT_SECRET is not set. A temporary development secret was generated; all sessions reset on restart.');
} else if (!IS_PRODUCTION && (configuredJwtSecret.length < 32 || looksLikePlaceholderSecret)) {
    console.warn('⚠️ JWT_SECRET is weak or looks like a placeholder. Use a unique 32+ character secret before deployment.');
}

const app = express();
const PORT = process.env.PORT || 3003;
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const OLLAMA_MAX_TOKENS = Math.min(Math.max(Number.parseInt(process.env.OLLAMA_MAX_TOKENS || '1000', 10) || 1000, 64), 2000);
// Streaming only needs a timeout for silence (model loading can take a while); the answer itself may run as long as it needs.
const OLLAMA_STREAM_IDLE_MS = Math.min(Math.max(Number.parseInt(process.env.OLLAMA_STREAM_IDLE_MS || '60000', 10) || 60000, 10000), 180000);
const OLLAMA_TIMEOUT_MS = Math.min(Math.max(Number.parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10) || 30000, 5000), 30000);
const OLLAMA_SYSTEM_PROMPT = 'Je bent LifeBuddy, een behulpzame studie-assistent. Antwoord altijd in het Nederlands, vriendelijk en praktisch. Geef volledige antwoorden met duidelijke uitleg en opsommingen wanneer dat helpt. Wees alleen kort als de gebruiker daar expliciet om vraagt.';
const configuredCorsOrigins = new Set(String(process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean));
let databaseReady = false;
let databaseInitError = null;

function isLocalBrowserOrigin(origin) {
    try {
        const url = new URL(origin);
        return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    } catch {
        return false;
    }
}

async function askOllama(messages, maxTokens = OLLAMA_MAX_TOKENS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages,
                stream: false,
                options: { temperature: 0.7, num_predict: maxTokens }
            })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `Ollama returned ${response.status}`);
        }
        const answer = data?.message?.content?.trim();
        if (!answer) throw new Error('Ollama returned an empty response');
        return answer;
    } finally {
        clearTimeout(timeout);
    }
}

// Streams an Ollama answer. Calls onDelta(text) for every chunk and resolves with the full text.
// Aborts when `signal` fires (user pressed stop) or when Ollama stays silent for OLLAMA_STREAM_IDLE_MS.
async function askOllamaStream(messages, { signal, onDelta, maxTokens = OLLAMA_MAX_TOKENS } = {}) {
    const controller = new AbortController();
    let idleTimer = null;
    let timedOut = false;
    const armIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { timedOut = true; controller.abort(); }, OLLAMA_STREAM_IDLE_MS);
    };
    const onAbort = () => controller.abort();
    if (signal) signal.aborted ? controller.abort() : signal.addEventListener('abort', onAbort, { once: true });
    armIdleTimer();
    let fullText = '';
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: true, options: { temperature: 0.7, num_predict: maxTokens } })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Ollama returned ${response.status}`);
        }
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of response.body) {
            armIdleTimer();
            buffer += decoder.decode(chunk, { stream: true });
            let newline;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (!line) continue;
                let parsed;
                try { parsed = JSON.parse(line); } catch { continue; }
                if (parsed.error) throw new Error(parsed.error);
                const text = parsed?.message?.content || '';
                if (text) { fullText += text; onDelta?.(text); }
            }
        }
        return fullText;
    } catch (error) {
        if (error.name === 'AbortError' && timedOut) {
            const timeoutError = new Error('Ollama answered too slowly');
            timeoutError.code = 'timeout';
            timeoutError.partial = fullText;
            throw timeoutError;
        }
        error.partial = fullText;
        throw error;
    } finally {
        clearTimeout(idleTimer);
        signal?.removeEventListener('abort', onAbort);
    }
}

const CHAT_ERROR_MARKERS = ['Ik kan Ollama lokaal nu niet bereiken', 'Mijn antwoord duurde langer dan 30 seconden'];

// Retrying a failed answer re-sends the same message; do not store it twice in a row.
async function storeUserChatMessage(userId, message) {
    const [last] = await databaseAll('SELECT message, role FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT 1', [userId]);
    if (last && last.role === 'user' && last.message === message) return;
    await databaseRun('INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)', [uuidv4(), userId, message, 'user']);
}

async function buildChatMessages(userId) {
    const recentHistory = await databaseAll('SELECT message, role FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?', [userId, 20]);
    return [
        { role: 'system', content: OLLAMA_SYSTEM_PROMPT },
        ...recentHistory.reverse()
            // Older versions stored connection errors as assistant replies; they must not become model context.
            .filter((entry) => !(entry.role === 'assistant' && CHAT_ERROR_MARKERS.some((marker) => String(entry.message).startsWith(marker))))
            .map((entry) => ({ role: entry.role === 'assistant' ? 'assistant' : 'user', content: entry.message }))
    ];
}

function chatErrorPayload(error) {
    if (error.code === 'timeout' || error.name === 'AbortError') return { code: 'timeout', message: 'Ollama reageert niet op tijd. Controleer of het model geladen is en probeer het opnieuw.' };
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(`${error.message} ${error.cause?.code || ''}`)) return { code: 'unreachable', message: `Ik kan Ollama niet bereiken. Start Ollama met \`ollama serve\` en controleer of het model is gedownload met \`ollama pull ${OLLAMA_MODEL}\`.` };
    return { code: 'failed', message: 'Er ging iets mis bij het genereren van het antwoord. Probeer het opnieuw.' };
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header include local CLI checks and same-origin navigation.
        if (!origin || configuredCorsOrigins.has(origin) || (!IS_PRODUCTION && isLocalBrowserOrigin(origin))) return callback(null, true);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));
app.use('/api', (req, res, next) => {
    if (databaseReady) return next();
    return res.status(503).json({ error: databaseInitError || 'LifeBuddy is still preparing the database. Please try again shortly.' });
});

// ============================================================
// DATABASE
// ============================================================
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/lifebuddy.db', (err) => {
    if (err) {
        console.error('❌ Database error:', err.message);
    } else {
        console.log('✅ Database connected');
        initDatabase();
    }
});

const SUBJECT_COLOR_COUNT = 6;

// Every subject keeps one of six fixed colours, so a subject looks the same on every page.
async function nextSubjectColor(userId) {
    const rows = await databaseAll('SELECT color FROM subjects WHERE user_id = ? AND color IS NOT NULL', [userId]);
    const used = new Set(rows.map((row) => Number(row.color)));
    for (let index = 0; index < SUBJECT_COLOR_COUNT; index += 1) if (!used.has(index)) return index;
    return rows.length % SUBJECT_COLOR_COUNT;
}

async function ensureSubjectColorsAndTaskSubjects() {
    const subjectColumns = await databaseAll('PRAGMA table_info(subjects)');
    if (!subjectColumns.some((column) => column.name === 'color')) await databaseRun('ALTER TABLE subjects ADD COLUMN color INTEGER');
    const taskColumns = await databaseAll('PRAGMA table_info(tasks)');
    if (!taskColumns.some((column) => column.name === 'subject_id')) await databaseRun('ALTER TABLE tasks ADD COLUMN subject_id TEXT');
    if (!taskColumns.some((column) => column.name === 'test_id')) await databaseRun('ALTER TABLE tasks ADD COLUMN test_id TEXT');
    await databaseRun(`CREATE TABLE IF NOT EXISTS periods (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
    await databaseRun(`CREATE TABLE IF NOT EXISTS tests (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, title TEXT NOT NULL, test_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
    await databaseRun('CREATE INDEX IF NOT EXISTS idx_tests_user_date ON tests (user_id, test_date)');
    await databaseRun('CREATE INDEX IF NOT EXISTS idx_periods_user_start ON periods (user_id, start_date)');
    const missing = await databaseAll('SELECT id, user_id FROM subjects WHERE color IS NULL ORDER BY user_id, created_at ASC, id ASC');
    for (const subject of missing) {
        await databaseRun('UPDATE subjects SET color = ? WHERE id = ?', [await nextSubjectColor(subject.user_id), subject.id]);
    }
}

async function createGradeEntriesIndexes() {
    await databaseRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_entries_subject_period_label ON grade_entries(subject_id, period, label)');
    await databaseRun('CREATE INDEX IF NOT EXISTS idx_grade_entries_subject_id ON grade_entries(subject_id)');
    await databaseRun('CREATE INDEX IF NOT EXISTS idx_grade_entries_user_period ON grade_entries(user_id, period)');
}

async function migrateGradeEntriesSchema() {
    const tableRows = await databaseAll("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'grade_entries'");
    const tableSql = String(tableRows[0]?.sql || '');
    const columns = await databaseAll('PRAGMA table_info(grade_entries)');
    const names = new Set(columns.map((column) => column.name));
    const hasLegacyLabelConstraint = /UNIQUE\s*\(\s*subject_id\s*,\s*label\s*\)/i.test(tableSql);

    if (hasLegacyLabelConstraint) {
        const period = names.has('period') ? "COALESCE(NULLIF(TRIM(period), ''), 'Algemeen')" : "'Algemeen'";
        const weight = names.has('weight') ? 'CASE WHEN weight IS NULL OR weight <= 0 THEN 1 ELSE weight END' : '1';
        const resultText = names.has('result_text') ? 'result_text' : 'NULL';
        const countsTowardAverage = names.has('counts_toward_average') ? 'CASE WHEN counts_toward_average = 0 THEN 0 ELSE 1 END' : '1';
        const dateColumn = names.has('date') ? 'date' : 'NULL';
        const createdAt = names.has('created_at') ? 'COALESCE(created_at, CURRENT_TIMESTAMP)' : 'CURRENT_TIMESTAMP';

        await databaseRun('BEGIN IMMEDIATE TRANSACTION');
        try {
            await databaseRun('DROP TABLE IF EXISTS grade_entries_migrating');
            await databaseRun(`
                CREATE TABLE grade_entries_migrating (
                    id TEXT PRIMARY KEY,
                    subject_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    label TEXT NOT NULL,
                    grade REAL NOT NULL,
                    period TEXT NOT NULL DEFAULT 'Algemeen',
                    weight REAL NOT NULL DEFAULT 1,
                    result_text TEXT,
                    counts_toward_average INTEGER NOT NULL DEFAULT 1,
                    date TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            await databaseRun(`
                INSERT INTO grade_entries_migrating (id, subject_id, user_id, label, grade, period, weight, result_text, counts_toward_average, date, created_at)
                SELECT id, subject_id, user_id, label, grade, ${period}, ${weight}, ${resultText}, ${countsTowardAverage}, ${dateColumn}, ${createdAt}
                FROM grade_entries
            `);
            await databaseRun('DROP TABLE grade_entries');
            await databaseRun('ALTER TABLE grade_entries_migrating RENAME TO grade_entries');
            await createGradeEntriesIndexes();
            await databaseRun('COMMIT');
            console.log('✅ Grade entries migrated to period-aware labels');
        } catch (error) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw error;
        }
        return;
    }

    const migrations = [];
    if (!names.has('period')) migrations.push("ALTER TABLE grade_entries ADD COLUMN period TEXT NOT NULL DEFAULT 'Algemeen'");
    if (!names.has('weight')) migrations.push('ALTER TABLE grade_entries ADD COLUMN weight REAL NOT NULL DEFAULT 1');
    if (!names.has('result_text')) migrations.push('ALTER TABLE grade_entries ADD COLUMN result_text TEXT');
    if (!names.has('counts_toward_average')) migrations.push('ALTER TABLE grade_entries ADD COLUMN counts_toward_average INTEGER NOT NULL DEFAULT 1');
    if (!names.has('date')) migrations.push('ALTER TABLE grade_entries ADD COLUMN date TEXT');
    for (const migration of migrations) await databaseRun(migration);
    await createGradeEntriesIndexes();
}

function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            plan TEXT DEFAULT 'free',
            streak INTEGER NOT NULL DEFAULT 0,
            last_study_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            role TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            due_date DATETIME,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            grade REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS grade_entries (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            label TEXT NOT NULL,
            grade REAL NOT NULL,
            period TEXT NOT NULL DEFAULT 'Algemeen',
            weight REAL NOT NULL DEFAULT 1,
            result_text TEXT,
            counts_toward_average INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subject_id) REFERENCES subjects(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (error) => {
        if (error) {
            console.error('❌ Grade entries table migration failed:', error.message);
            databaseInitError = 'Grade entries could not be prepared.';
            return;
        }
        migrateGradeEntriesSchema()
            .then(() => ensureSubjectColorsAndTaskSubjects())
            .then(() => { databaseReady = true; console.log('✅ Database ready'); })
            .catch((migrationError) => {
                databaseInitError = 'Grade entries could not be migrated safely.';
                console.error('❌ Grade entries schema migration failed:', migrationError.message);
            });
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            id TEXT PRIMARY KEY,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id),
            CHECK(sender_id != receiver_id)
        )
    `, (error) => {
        if (error) {
            console.error('❌ Friends table migration failed:', error.message);
            return;
        }
        db.run('CREATE INDEX IF NOT EXISTS idx_friend_requests_users ON friend_requests(sender_id, receiver_id, status)', (indexError) => {
            if (indexError) console.error('❌ Friends index migration failed:', indexError.message);
        });
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS word_lists (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            term_language TEXT,
            definition_language TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (error) => {
        if (error) return console.error('❌ Word lists table migration failed:', error.message);
        db.run('CREATE INDEX IF NOT EXISTS idx_word_lists_user_id ON word_lists(user_id)');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS word_entries (
            id TEXT PRIMARY KEY,
            list_id TEXT NOT NULL,
            term TEXT NOT NULL,
            definition TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(list_id, term),
            FOREIGN KEY (list_id) REFERENCES word_lists(id)
        )
    `, (error) => {
        if (error) return console.error('❌ Word entries table migration failed:', error.message);
        db.run('CREATE INDEX IF NOT EXISTS idx_word_entries_list_id ON word_entries(list_id)');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            list_id TEXT NOT NULL,
            method TEXT NOT NULL,
            direction TEXT NOT NULL DEFAULT 'term_definition',
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            score REAL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (list_id) REFERENCES word_lists(id)
        )
    `, (error) => {
        if (error) return console.error('❌ Practice sessions table migration failed:', error.message);
        db.run('CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_list ON practice_sessions(user_id, list_id)');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS practice_session_entries (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            direction TEXT NOT NULL,
            is_correct INTEGER,
            attempts INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES practice_sessions(id),
            FOREIGN KEY (entry_id) REFERENCES word_entries(id),
            UNIQUE(session_id, entry_id)
        )
    `, (error) => {
        if (error) return console.error('❌ Practice session entries migration failed:', error.message);
        db.run('CREATE INDEX IF NOT EXISTS idx_practice_session_entries_session ON practice_session_entries(session_id, position)');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS word_progress (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            correct_count INTEGER NOT NULL DEFAULT 0,
            wrong_count INTEGER NOT NULL DEFAULT 0,
            last_practiced_at DATETIME,
            UNIQUE(user_id, entry_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (entry_id) REFERENCES word_entries(id)
        )
    `, (error) => {
        if (error) return console.error('❌ Word progress table migration failed:', error.message);
        db.run('CREATE INDEX IF NOT EXISTS idx_word_progress_user_entry ON word_progress(user_id, entry_id)');
    });

    // Migrate existing installations without requiring users to recreate their data.
    db.all('PRAGMA table_info(users)', (err, columns) => {
        if (err) {
            console.error('❌ Could not inspect users table:', err.message);
            return;
        }

        const names = new Set(columns.map((column) => column.name));
        if (!names.has('streak')) {
            db.run('ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0', (migrationError) => {
                if (migrationError) console.error('❌ Streak migration failed:', migrationError.message);
            });
        }
        if (!names.has('last_study_date')) {
            db.run('ALTER TABLE users ADD COLUMN last_study_date DATETIME', (migrationError) => {
                if (migrationError) console.error('❌ Study date migration failed:', migrationError.message);
            });
        }
    });

    console.log('⏳ Database initialization started');
}

function updateStreak(userId, callback = () => {}) {
    db.get(
        'SELECT streak, last_study_date FROM users WHERE id = ?',
        [userId],
        (err, user) => {
            if (err || !user) {
                callback(err || new Error('User not found'));
                return;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentStreak = Number(user.streak) || 0;
            let nextStreak = currentStreak;

            if (!user.last_study_date) {
                nextStreak = 1;
            } else {
                const lastStudyDate = new Date(`${String(user.last_study_date).slice(0, 10)}T00:00:00`);
                lastStudyDate.setHours(0, 0, 0, 0);
                const daysSinceLastActivity = Math.round((today - lastStudyDate) / 86400000);

                if (daysSinceLastActivity === 1) nextStreak = currentStreak + 1;
                if (daysSinceLastActivity > 1) nextStreak = 1;
            }

            db.run(
                "UPDATE users SET streak = ?, last_study_date = date('now', 'localtime') WHERE id = ?",
                [nextStreak, userId],
                (updateError) => callback(updateError, nextStreak)
            );
        }
    );
}

function normalizeSubjectName(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('nl-NL');
}

function databaseAll(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parameters, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function databaseRun(sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parameters, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function normalizeGradeLabel(value, fallback = 'Cijfer') {
    const label = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return (label || fallback).slice(0, 60);
}

function normalizeGradePeriod(value) {
    const period = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return (period || 'Algemeen').slice(0, 40);
}

function normalizeGradeDate(value) {
    const date = typeof value === 'string' ? value.trim() : '';
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date) ? date : null;
}

function normalizeGradeWeight(value) {
    const weight = Number(value);
    return Number.isFinite(weight) && weight > 0 && weight <= 10000 ? weight : 1;
}

function parseGradeEntries(rawGrades, fallbackGrade, fallbackLabel = 'Cijfer') {
    const input = Array.isArray(rawGrades)
        ? rawGrades
        : fallbackGrade === null || fallbackGrade === undefined || fallbackGrade === ''
            ? []
            : [{ label: fallbackLabel, grade: fallbackGrade }];
    const entries = new Map();

    for (const rawEntry of input) {
        const rawGrade = Number(rawEntry?.grade);
        const resultText = typeof rawEntry?.resultText === 'string' ? rawEntry.resultText.trim().slice(0, 30) : '';
        const label = normalizeGradeLabel(rawEntry?.label, fallbackLabel);
        const period = normalizeGradePeriod(rawEntry?.period);
        const weight = normalizeGradeWeight(rawEntry?.weight);
        const date = normalizeGradeDate(rawEntry?.date);
        const isNumeric = Number.isFinite(rawGrade) && rawGrade >= 0 && rawGrade <= 10;
        if (!isNumeric && !resultText) {
            throw new Error('Every grade must be a number between 0 and 10');
        }
        entries.set(`${normalizeSubjectName(period)}:${normalizeSubjectName(label)}`, {
            label,
            period,
            weight,
            grade: isNumeric ? Math.round(rawGrade * 10) / 10 : 0,
            resultText: resultText || null,
            date,
            countsTowardAverage: isNumeric && rawEntry?.countsTowardAverage !== false
        });
    }

    return [...entries.values()];
}

function averageGrade(entries) {
    const numericEntries = entries.filter((entry) => entry.countsTowardAverage !== false && Number(entry.counts_toward_average) !== 0 && Number.isFinite(Number(entry.grade)));
    if (!numericEntries.length) return null;
    const totalWeight = numericEntries.reduce((total, entry) => total + normalizeGradeWeight(entry.weight), 0);
    if (!totalWeight) return null;
    return Math.round((numericEntries.reduce((total, entry) => total + (entry.grade * normalizeGradeWeight(entry.weight)), 0) / totalWeight) * 10) / 10;
}

async function ensureLegacyGradeEntry(subject) {
    if (subject.grade === null || subject.grade === undefined) return;
    const entries = await databaseAll('SELECT id FROM grade_entries WHERE subject_id = ? LIMIT 1', [subject.id]);
    if (!entries.length) {
        await databaseRun(
            'INSERT INTO grade_entries (id, subject_id, user_id, label, grade, period, weight, result_text, counts_toward_average) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), subject.id, subject.user_id, 'Eerder cijfer', subject.grade, 'Algemeen', 1, null, 1]
        );
    }
}

async function buildSubjectsWithGrades(userId) {
    const [subjects, entries] = await Promise.all([
        databaseAll('SELECT * FROM subjects WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC', [userId]),
        databaseAll('SELECT id, date, subject_id, label, grade, period, weight, result_text, counts_toward_average FROM grade_entries WHERE user_id = ? ORDER BY created_at ASC, label COLLATE NOCASE ASC', [userId])
    ]);
    const entriesBySubject = new Map();
    entries.forEach((entry) => {
        const current = entriesBySubject.get(entry.subject_id) || [];
        current.push({ id: entry.id, date: entry.date || null, label: entry.label, grade: entry.grade, period: normalizeGradePeriod(entry.period), weight: normalizeGradeWeight(entry.weight), resultText: entry.result_text || null, countsTowardAverage: Number(entry.counts_toward_average) !== 0 });
        entriesBySubject.set(entry.subject_id, current);
    });

    return subjects.map((subject) => {
        const grades = entriesBySubject.get(subject.id) || (subject.grade === null || subject.grade === undefined ? [] : [{ label: 'Eerder cijfer', grade: subject.grade, period: 'Algemeen', weight: 1, countsTowardAverage: true }]);
        const sourceGrades = grades.filter((entry) => entry.period !== 'Eindcijfers');
        return { ...subject, grade: averageGrade(sourceGrades.length ? sourceGrades : grades), grades };
    });
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

app.get('/health', (req, res) => {
    res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ok' : 'starting',
        database: databaseReady ? 'ready' : 'pending',
        error: databaseInitError || undefined
    });
});

// ============================================================
// API ROUTES
// ============================================================

// ---------- AUTH ----------
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== 'string') {
        return res.status(400).json({ error: 'A valid email address and password are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must contain at least 8 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        db.run(
            'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
            [userId, normalizedEmail, hashedPassword, normalizedName || normalizedEmail.split('@')[0]],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Registration failed' });
                }

                const token = jwt.sign(
                    { id: userId, email: normalizedEmail, plan: 'free' },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.json({
                    token,
                    user: { id: userId, email: normalizedEmail, name: normalizedName || normalizedEmail.split('@')[0], plan: 'free' }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password required' });
    }

    db.get('SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, plan: user.plan },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan
            }
        });
    });
});

// ---------- USER PROFILE ----------
app.get('/api/user/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, email, name, plan, streak, last_study_date FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    });
});

app.put('/api/user/profile', authenticateToken, (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 80) return res.status(400).json({ error: 'Name must contain between 1 and 80 characters' });
    db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Update failed' });
        }
        res.json({ success: true, name });
    });
});

// ---------- TASKS ----------
app.get('/api/tasks', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC',
        [req.user.id],
        (err, tasks) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch tasks' });
            }
            res.json(tasks);
        }
    );
});

// Only a subject that belongs to the user may be linked to a task.
function resolveOwnedTest(userId, value, callback) {
    if (typeof value !== 'string' || !value) return callback(null);
    db.get('SELECT id FROM tests WHERE id = ? AND user_id = ?', [value, userId], (error, row) => callback(!error && row ? row.id : null));
}

function resolveOwnedSubject(userId, value, callback) {
    if (typeof value !== 'string' || !value) return callback(null);
    db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [value, userId], (error, row) => callback(!error && row ? row.id : null));
}

app.post('/api/tasks', authenticateToken, (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().replace(/\s+/g, ' ') : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const due_date = typeof req.body?.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date) ? req.body.due_date : null;

    if (!title || title.length > 180) {
        return res.status(400).json({ error: 'Task title must contain between 1 and 180 characters' });
    }
    if (description.length > 2000) return res.status(400).json({ error: 'Task details may contain up to 2000 characters' });

    function createTask(subjectId, testId) {
        const id = uuidv4();
        db.run(
            'INSERT INTO tasks (id, user_id, title, description, due_date, subject_id, test_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.id, title, description || '', due_date || null, subjectId || null, testId || null],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create task' });
                }
                updateStreak(req.user.id, (streakError, streak) => {
                    if (streakError) {
                        return res.status(500).json({ error: 'Failed to update study streak' });
                    }
                    db.get('SELECT * FROM tasks WHERE id = ?', [id], (taskError, task) => {
                        if (taskError) return res.status(500).json({ error: 'Failed to load task' });
                        res.json({ ...task, streak });
                    });
                });
            }
        );
    }

    resolveOwnedSubject(req.user.id, req.body?.subject_id, (subjectId) => resolveOwnedTest(req.user.id, req.body?.test_id, (testId) => createTask(subjectId, testId)));
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().replace(/\s+/g, ' ') : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const due_date = typeof req.body?.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date) ? req.body.due_date : null;
    const status = req.body?.status === 'completed' ? 'completed' : 'pending';
    const taskId = req.params.id;

    if (!title || title.length > 180) return res.status(400).json({ error: 'Task title must contain between 1 and 180 characters' });
    if (description.length > 2000) return res.status(400).json({ error: 'Task details may contain up to 2000 characters' });

    const body = req.body || {};
    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
    resolveOwnedSubject(req.user.id, body.subject_id, (subjectId) => resolveOwnedTest(req.user.id, body.test_id, (testId) => {
    const sets = ['title = ?', 'description = ?', 'due_date = ?', 'status = ?'];
    const values = [title, description, due_date, status];
    if (has('subject_id')) { sets.push('subject_id = ?'); values.push(subjectId); }
    if (has('test_id')) { sets.push('test_id = ?'); values.push(testId); }
    db.run(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
        [...values, taskId, req.user.id],
        function(err) {
            if (err || this.changes === 0) {
                return res.status(404).json({ error: 'Task not found or unauthorized' });
            }
            const respondWithTask = (streak) => {
                db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (taskError, task) => {
                    if (taskError) return res.status(500).json({ error: 'Failed to load task' });
                    res.json({ ...task, streak });
                });
            };

            if (status === 'completed') {
                updateStreak(req.user.id, (streakError, streak) => {
                    if (streakError) return res.status(500).json({ error: 'Failed to update study streak' });
                    respondWithTask(streak);
                });
                return;
            }

            respondWithTask();
        }
    ); }));
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM tasks WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        function(err) {
            if (err || this.changes === 0) {
                return res.status(404).json({ error: 'Task not found or unauthorized' });
            }
            res.json({ success: true });
        }
    );
});

// ---------- SUBJECTS & GRADE BOOK ----------
app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        res.json(await buildSubjectsWithGrades(req.user.id));
    } catch (error) {
        console.error('❌ Subjects error:', error.message);
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

async function saveSubjectGrades(userId, rawSubject, { allowEmptyGrades = false } = {}) {
    const name = typeof rawSubject?.name === 'string' ? rawSubject.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 80) throw new Error('A subject needs a name of at most 80 characters');

    const grades = parseGradeEntries(rawSubject?.grades, rawSubject?.grade, rawSubject?.label || 'Cijfer');
    if (!allowEmptyGrades && !grades.length) throw new Error('Add at least one grade between 0 and 10');

    const existingSubjects = await databaseAll('SELECT * FROM subjects WHERE user_id = ?', [userId]);
    const existing = existingSubjects.find((subject) => normalizeSubjectName(subject.name) === normalizeSubjectName(name));
    let subject = existing;
    let created = false;

    if (subject) {
        await ensureLegacyGradeEntry(subject);
        await databaseRun('UPDATE subjects SET name = ? WHERE id = ? AND user_id = ?', [name, subject.id, userId]);
    } else {
        subject = { id: uuidv4(), user_id: userId, name, grade: null, color: await nextSubjectColor(userId) };
        await databaseRun('INSERT INTO subjects (id, user_id, name, grade, color) VALUES (?, ?, ?, ?, ?)', [subject.id, userId, name, null, subject.color]);
        created = true;
    }

    for (const entry of grades) {
        await databaseRun(
            `INSERT INTO grade_entries (id, subject_id, user_id, label, grade, period, weight, result_text, counts_toward_average, date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(subject_id, period, label) DO UPDATE SET
                date = COALESCE(excluded.date, grade_entries.date),
                grade = excluded.grade,
                weight = excluded.weight,
                result_text = excluded.result_text,
                counts_toward_average = excluded.counts_toward_average`,
            [uuidv4(), subject.id, userId, entry.label, entry.grade, entry.period, entry.weight, entry.resultText, entry.countsTowardAverage ? 1 : 0, entry.date]
        );
    }

    const savedEntries = await databaseAll('SELECT label, grade, period, weight, result_text, counts_toward_average FROM grade_entries WHERE subject_id = ? ORDER BY created_at ASC, label COLLATE NOCASE ASC', [subject.id]);
    const sourceEntries = savedEntries.filter((entry) => normalizeGradePeriod(entry.period) !== 'Eindcijfers');
    const average = averageGrade(sourceEntries.length ? sourceEntries : savedEntries);
    await databaseRun('UPDATE subjects SET grade = ? WHERE id = ? AND user_id = ?', [average, subject.id, userId]);
    return { id: subject.id, created, gradesSaved: grades.length };
}

app.post('/api/subjects', authenticateToken, async (req, res) => {
    try {
        await databaseRun('BEGIN TRANSACTION');
        let result;
        try {
            result = await saveSubjectGrades(req.user.id, req.body, { allowEmptyGrades: true });
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }

        updateStreak(req.user.id, async (streakError, streak) => {
            if (streakError) return res.status(500).json({ error: 'Subject saved, but the study streak could not be updated' });
            const subjects = await buildSubjectsWithGrades(req.user.id);
            res.status(result.created ? 201 : 200).json({ subject: subjects.find((subject) => subject.id === result.id), streak });
        });
    } catch (error) {
        console.error('❌ Save subject failed:', error.message);
        res.status(400).json({ error: error.message || 'Could not save the subject' });
    }
});

// ---------- CSV SUBJECT IMPORT ----------
app.post('/api/subjects/import', authenticateToken, async (req, res) => {
    const rawSubjects = req.body?.subjects;
    if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) {
        return res.status(400).json({ error: 'No valid subjects were found in the CSV file' });
    }

    try {
        const groupedSubjects = new Map();
        for (const rawSubject of rawSubjects) {
            const name = typeof rawSubject?.name === 'string' ? rawSubject.name.trim().replace(/\s+/g, ' ') : '';
            if (!name || name.length > 80) throw new Error('Every imported subject needs a valid name');
            const grades = parseGradeEntries(rawSubject?.grades, rawSubject?.grade);
            if (!grades.length) throw new Error('Every imported subject needs at least one grade between 0 and 10');
            const key = normalizeSubjectName(name);
            const current = groupedSubjects.get(key) || { name, grades: [] };
            current.grades.push(...grades);
            groupedSubjects.set(key, current);
        }

        let created = 0;
        let updated = 0;
        let gradesSaved = 0;
        await databaseRun('BEGIN TRANSACTION');
        try {
            for (const subject of groupedSubjects.values()) {
                const result = await saveSubjectGrades(req.user.id, subject);
                if (result.created) created++; else updated++;
                gradesSaved += result.gradesSaved;
            }
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }

        updateStreak(req.user.id, (streakError, streak) => {
            if (streakError) return res.status(500).json({ error: 'Grades were imported, but the study streak could not be updated' });
            res.status(201).json({ success: true, imported: groupedSubjects.size, created, updated, gradesSaved, streak });
        });
    } catch (error) {
        console.error('❌ CSV subject import failed:', error.message);
        res.status(400).json({ error: error.message || 'Could not import the CSV file.' });
    }
});

app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
    try {
        const subject = await databaseAll('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!subject.length) return res.status(404).json({ error: 'Subject not found or unauthorized' });
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun('DELETE FROM grade_entries WHERE subject_id = ? AND user_id = ?', [req.params.id, req.user.id]);
            await databaseRun('UPDATE tasks SET test_id = NULL WHERE user_id = ? AND test_id IN (SELECT id FROM tests WHERE subject_id = ?)', [req.user.id, req.params.id]);
            await databaseRun('DELETE FROM tests WHERE subject_id = ? AND user_id = ?', [req.params.id, req.user.id]);
            await databaseRun('UPDATE tasks SET subject_id = NULL WHERE subject_id = ? AND user_id = ?', [req.params.id, req.user.id]);
            await databaseRun('DELETE FROM subjects WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Could not delete subject' });
    }
});

// ---------- PERIODS AND TESTS ----------
function validDateText(value) { return normalizeGradeDate(value); }

function readPeriodBody(body) {
    const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    const start = validDateText(body?.start_date), end = validDateText(body?.end_date);
    if (!name || name.length > 40) return { error: 'Period name must contain between 1 and 40 characters' };
    if (!start || !end) return { error: 'Start and end date must be valid dates (YYYY-MM-DD)' };
    if (end < start) return { error: 'End date must not be before the start date' };
    return { name, start, end };
}

async function periodProblem(userId, period, excludeId) {
    const rows = await databaseAll('SELECT id, name, start_date, end_date FROM periods WHERE user_id = ? AND id != ?', [userId, excludeId || '']);
    if (rows.some((row) => row.name.toLowerCase() === period.name.toLowerCase())) return 'A period with this name already exists';
    if (rows.some((row) => row.start_date <= period.end && row.end_date >= period.start)) return 'This period overlaps with another period';
    return null;
}

app.get('/api/periods', authenticateToken, async (req, res) => {
    try { res.json(await databaseAll('SELECT id, name, start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date ASC', [req.user.id])); }
    catch (error) { res.status(500).json({ error: 'Could not load periods' }); }
});

app.post('/api/periods', authenticateToken, async (req, res) => {
    try {
        const period = readPeriodBody(req.body);
        if (period.error) return res.status(400).json({ error: period.error });
        const problem = await periodProblem(req.user.id, period);
        if (problem) return res.status(409).json({ error: problem });
        const id = uuidv4();
        await databaseRun('INSERT INTO periods (id, user_id, name, start_date, end_date) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, period.name, period.start, period.end]);
        res.status(201).json({ id, name: period.name, start_date: period.start, end_date: period.end });
    } catch (error) { res.status(500).json({ error: 'Could not save period' }); }
});

app.put('/api/periods/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await databaseAll('SELECT id FROM periods WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!existing.length) return res.status(404).json({ error: 'Period not found' });
        const period = readPeriodBody(req.body);
        if (period.error) return res.status(400).json({ error: period.error });
        const problem = await periodProblem(req.user.id, period, req.params.id);
        if (problem) return res.status(409).json({ error: problem });
        await databaseRun('UPDATE periods SET name = ?, start_date = ?, end_date = ? WHERE id = ? AND user_id = ?', [period.name, period.start, period.end, req.params.id, req.user.id]);
        res.json({ id: req.params.id, name: period.name, start_date: period.start, end_date: period.end });
    } catch (error) { res.status(500).json({ error: 'Could not save period' }); }
});

app.delete('/api/periods/:id', authenticateToken, async (req, res) => {
    try {
        const result = await databaseRun('DELETE FROM periods WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!result.changes) return res.status(404).json({ error: 'Period not found' });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Could not delete period' }); }
});

// A test's period is derived from its date (never stored), so tests and periods can not contradict each other.
const TEST_SELECT = `SELECT t.id, t.subject_id, t.title, t.test_date,
    (SELECT p.name FROM periods p WHERE p.user_id = t.user_id AND t.test_date BETWEEN p.start_date AND p.end_date LIMIT 1) AS period,
    (SELECT COUNT(*) FROM tasks k WHERE k.test_id = t.id) AS prep_total,
    (SELECT COUNT(*) FROM tasks k WHERE k.test_id = t.id AND k.status != 'completed') AS prep_open
    FROM tests t WHERE t.user_id = ?`;

async function readTestBody(userId, body, excludeId) {
    const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
    const date = validDateText(body?.test_date);
    if (!title || title.length > 120) return { error: 'Title must contain between 1 and 120 characters' };
    if (!date) return { error: 'Test date must be a valid date (YYYY-MM-DD)' };
    const subject = typeof body?.subject_id === 'string' ? (await databaseAll('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [body.subject_id, userId]))[0] : null;
    if (!subject) return { error: 'Choose one of your own subjects' };
    const duplicate = await databaseAll('SELECT id FROM tests WHERE user_id = ? AND subject_id = ? AND test_date = ? AND LOWER(title) = LOWER(?) AND id != ?', [userId, subject.id, date, title, excludeId || '']);
    if (duplicate.length) return { error: 'This test already exists', status: 409 };
    return { title, date, subjectId: subject.id };
}

app.get('/api/tests', authenticateToken, async (req, res) => {
    try { res.json(await databaseAll(`${TEST_SELECT} ORDER BY t.test_date ASC, t.title ASC`, [req.user.id])); }
    catch (error) { res.status(500).json({ error: 'Could not load tests' }); }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
    try {
        const test = await readTestBody(req.user.id, req.body);
        if (test.error) return res.status(test.status || 400).json({ error: test.error });
        const id = uuidv4();
        await databaseRun('INSERT INTO tests (id, user_id, subject_id, title, test_date) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, test.subjectId, test.title, test.date]);
        res.status(201).json((await databaseAll(`${TEST_SELECT} AND t.id = ?`, [req.user.id, id]))[0]);
    } catch (error) { res.status(500).json({ error: 'Could not save test' }); }
});

app.put('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await databaseAll('SELECT id FROM tests WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!existing.length) return res.status(404).json({ error: 'Test not found' });
        const test = await readTestBody(req.user.id, req.body, req.params.id);
        if (test.error) return res.status(test.status || 400).json({ error: test.error });
        await databaseRun('UPDATE tests SET subject_id = ?, title = ?, test_date = ? WHERE id = ? AND user_id = ?', [test.subjectId, test.title, test.date, req.params.id, req.user.id]);
        res.json((await databaseAll(`${TEST_SELECT} AND t.id = ?`, [req.user.id, req.params.id]))[0]);
    } catch (error) { res.status(500).json({ error: 'Could not save test' }); }
});

app.delete('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await databaseAll('SELECT id FROM tests WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!existing.length) return res.status(404).json({ error: 'Test not found' });
        await databaseRun('UPDATE tasks SET test_id = NULL WHERE test_id = ? AND user_id = ?', [req.params.id, req.user.id]);
        await databaseRun('DELETE FROM tests WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Could not delete test' }); }
});

// ---------- DELETE ONE GRADE ----------
app.delete('/api/grade-entries/:id', authenticateToken, async (req, res) => {
    try {
        const [entry] = await databaseAll('SELECT id, subject_id FROM grade_entries WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!entry) return res.status(404).json({ error: 'Grade not found or unauthorized' });
        await databaseRun('DELETE FROM grade_entries WHERE id = ? AND user_id = ?', [entry.id, req.user.id]);
        const remaining = await databaseAll('SELECT grade, weight, counts_toward_average, period FROM grade_entries WHERE subject_id = ?', [entry.subject_id]);
        const source = remaining.filter((item) => normalizeGradePeriod(item.period) !== 'Eindcijfers');
        await databaseRun('UPDATE subjects SET grade = ? WHERE id = ? AND user_id = ?', [averageGrade(source.length ? source : remaining), entry.subject_id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Could not delete grade' });
    }
});

// ---------- DELETE ALL SUBJECTS ----------
app.delete('/api/subjects', authenticateToken, async (req, res) => {
    try {
        await databaseRun('BEGIN TRANSACTION');
        try {
            const result = await databaseRun('DELETE FROM subjects WHERE user_id = ?', [req.user.id]);
            await databaseRun('DELETE FROM grade_entries WHERE user_id = ?', [req.user.id]);
            await databaseRun('UPDATE tasks SET test_id = NULL, subject_id = NULL WHERE user_id = ?', [req.user.id]);
            await databaseRun('DELETE FROM tests WHERE user_id = ?', [req.user.id]);
            await databaseRun('COMMIT');
            res.json({ success: true, count: result.changes });
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
    } catch (error) {
        console.error('❌ Delete error:', error.message);
        res.status(500).json({ error: 'Could not delete subjects' });
    }
});

// ---------- STUDY ROOM: WORD LISTS ----------
const PRACTICE_METHODS = new Set(['test', 'multiple_choice', 'flashcards', 'spelling', 'mixed']);
const PRACTICE_DIRECTIONS = new Set(['term_definition', 'definition_term', 'mixed']);

function cleanStudyText(value, maximumLength) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximumLength) : '';
}

function normalizedStudyValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('nl-NL')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function acceptedStudyAnswers(value) {
    const fullValue = normalizedStudyValue(value);
    const alternatives = String(value || '').split('/').map(normalizedStudyValue).filter(Boolean);
    return [...new Set([fullValue, ...alternatives].filter(Boolean))];
}

function answerMatchesStudyValue(answer, expected) {
    const normalizedAnswer = normalizedStudyValue(answer);
    return Boolean(normalizedAnswer) && acceptedStudyAnswers(expected).includes(normalizedAnswer);
}

function shuffleStudyItems(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

// Priority for choosing which words to practise when a session is shorter than the candidate pool:
// new words and words answered wrongly come first, long-untouched words next, well-known words last.
function practicePriority(entry, now = Date.now()) {
    const correct = Number(entry.correct_count) || 0;
    const wrong = Number(entry.wrong_count) || 0;
    const attempts = correct + wrong;
    if (!attempts) return 2.2;
    const lastPracticed = entry.last_practiced_at ? Date.parse(`${String(entry.last_practiced_at).replace(' ', 'T')}Z`) : NaN;
    const daysSince = Number.isFinite(lastPracticed) ? Math.max(0, (now - lastPracticed) / 86400000) : 7;
    const mastered = attempts >= 3 && correct >= wrong * 2;
    return 1 + (wrong / attempts) * 2 + Math.min(daysSince, 14) / 14 * 0.6 - (mastered ? 1.1 : 0);
}

function pickPracticeEntries(candidates, count) {
    if (count >= candidates.length) return shuffleStudyItems(candidates);
    const ranked = candidates
        .map((entry) => ({ entry, score: practicePriority(entry) + Math.random() * 0.6 }))
        .sort((left, right) => right.score - left.score)
        .slice(0, count)
        .map((item) => item.entry);
    return shuffleStudyItems(ranked);
}

function resolvePracticeDirection(method, direction) {
    if (method === 'mixed' || direction === 'mixed') {
        return Math.random() < 0.5 ? 'term_definition' : 'definition_term';
    }
    return direction;
}

function practicePrompt(entry, direction, method) {
    if (method === 'spelling') return 'Bekijk het woord goed en typ het daarna exact over.';
    return direction === 'definition_term' ? entry.definition : entry.term;
}

function practiceExpectedAnswer(entry, direction, method) {
    if (method === 'spelling') return entry.term;
    return direction === 'definition_term' ? entry.term : entry.definition;
}

function studyHint(value) {
    const characters = [...String(value || '')];
    let revealed = 0;
    return characters.map((character) => {
        if (!/[\p{L}\p{N}]/u.test(character)) return character;
        revealed++;
        return revealed <= 2 ? character : '•';
    }).join('');
}

function validateWordEntry(rawEntry) {
    const term = cleanStudyText(rawEntry?.term, 250);
    const definition = cleanStudyText(rawEntry?.definition, 500);
    if (!term || !definition) throw new Error('Elke term heeft een woord en definitie nodig');
    return { term, definition };
}

async function getOwnedWordList(listId, userId) {
    const lists = await databaseAll('SELECT * FROM word_lists WHERE id = ? AND user_id = ? LIMIT 1', [listId, userId]);
    return lists[0] || null;
}

async function getWordEntriesWithProgress(listId, userId) {
    return databaseAll(
        `SELECT entries.*, COALESCE(progress.correct_count, 0) AS correct_count,
                COALESCE(progress.wrong_count, 0) AS wrong_count, progress.last_practiced_at
         FROM word_entries AS entries
         LEFT JOIN word_progress AS progress ON progress.entry_id = entries.id AND progress.user_id = ?
         WHERE entries.list_id = ?
         ORDER BY entries.created_at ASC, entries.term COLLATE NOCASE ASC`,
        [userId, listId]
    );
}

function normalizePracticeSelection(selection) {
    if (Array.isArray(selection)) return { mode: 'selected', entryIds: selection, count: 'all' };
    if (typeof selection !== 'object' || !selection) return { mode: 'all', entryIds: [], count: 'auto' };
    const mode = ['all', 'difficult', 'unpracticed', 'selected'].includes(selection.mode || selection.filter)
        ? (selection.mode || selection.filter)
        : 'all';
    return {
        mode,
        entryIds: Array.isArray(selection.entryIds) ? selection.entryIds.map(String) : [],
        count: selection.count === 'all' || selection.count === 'auto' ? selection.count : Number(selection.count) || 'auto'
    };
}

// "Automatic" session length: up to 20 words everything is asked, above that half of the words.
function autoPracticeCount(wordCount) {
    return wordCount <= 20 ? wordCount : Math.ceil(wordCount / 2);
}

function createPracticeQuestion(session, sessionEntry, entry, candidates) {
    const method = session.method === 'mixed' ? 'test' : session.method;
    const direction = sessionEntry.direction;
    const expectedAnswer = practiceExpectedAnswer(entry, direction, method);
    const question = {
        entryId: sessionEntry.entry_id,
        method,
        direction,
        prompt: practicePrompt(entry, direction, method),
        hint: studyHint(expectedAnswer),
        position: sessionEntry.position
    };

    if (method === 'multiple_choice') {
        const alternatives = shuffleStudyItems(candidates.filter((candidate) => candidate.id !== sessionEntry.entry_id))
            .map((candidate) => practiceExpectedAnswer(candidate, direction, method))
            .filter((value, index, values) => normalizedStudyValue(value) && values.findIndex((item) => normalizedStudyValue(item) === normalizedStudyValue(value)) === index)
            .slice(0, 3);
        question.options = shuffleStudyItems([expectedAnswer, ...alternatives]);
    }
    if (method === 'flashcards') question.reveal = expectedAnswer;
    if (method === 'spelling') question.spellingPreview = entry.term;
    return question;
}

async function buildNextPracticeQuestion(session) {
    const remaining = await databaseAll(
        `SELECT session_entries.*, entries.term, entries.definition
         FROM practice_session_entries AS session_entries
         JOIN word_entries AS entries ON entries.id = session_entries.entry_id
         WHERE session_entries.session_id = ? AND session_entries.is_correct IS NULL
         ORDER BY session_entries.position ASC LIMIT 1`,
        [session.id]
    );
    if (!remaining.length) return null;
    const candidates = await databaseAll('SELECT id, term, definition FROM word_entries WHERE list_id = ?', [session.list_id]);
    return createPracticeQuestion(session, remaining[0], remaining[0], candidates);
}

async function buildPracticeResult(sessionId) {
    const totals = await databaseAll(
        `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
                COALESCE(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong
         FROM practice_session_entries WHERE session_id = ?`,
        [sessionId]
    );
    const wrongEntries = await databaseAll('SELECT entry_id FROM practice_session_entries WHERE session_id = ? AND is_correct = 0 ORDER BY position', [sessionId]);
    const total = Number(totals[0]?.total) || 0;
    const correct = Number(totals[0]?.correct) || 0;
    return {
        total,
        correct,
        wrong: Number(totals[0]?.wrong) || 0,
        score: total ? Math.round((correct / total) * 100) : 0,
        wrongEntryIds: wrongEntries.map((item) => item.entry_id)
    };
}

app.get('/api/word-lists', authenticateToken, async (req, res) => {
    try {
        const lists = await databaseAll(
            `SELECT lists.*,
                (SELECT COUNT(*) FROM word_entries WHERE list_id = lists.id) AS entry_count,
                (SELECT COUNT(*) FROM word_entries AS entries
                    LEFT JOIN word_progress AS progress ON progress.entry_id = entries.id AND progress.user_id = lists.user_id
                    WHERE entries.list_id = lists.id AND (COALESCE(progress.correct_count, 0) + COALESCE(progress.wrong_count, 0)) > 0) AS practiced_count,
                (SELECT COUNT(*) FROM word_entries AS entries
                    LEFT JOIN word_progress AS progress ON progress.entry_id = entries.id AND progress.user_id = lists.user_id
                    WHERE entries.list_id = lists.id AND COALESCE(progress.wrong_count, 0) > COALESCE(progress.correct_count, 0)) AS difficult_count
             FROM word_lists AS lists WHERE lists.user_id = ? ORDER BY lists.created_at DESC`,
            [req.user.id]
        );
        res.json(lists);
    } catch (error) {
        console.error('❌ Word lists fetch failed:', error.message);
        res.status(500).json({ error: 'Could not load word lists' });
    }
});

app.post('/api/word-lists', authenticateToken, async (req, res) => {
    const title = cleanStudyText(req.body?.title, 120);
    const description = cleanStudyText(req.body?.description, 1000);
    if (!title) return res.status(400).json({ error: 'Geef je woordenlijst een titel' });
    try {
        const list = {
            id: uuidv4(), user_id: req.user.id, title, description: description || null,
            termLanguage: cleanStudyText(req.body?.termLanguage, 50) || null,
            definitionLanguage: cleanStudyText(req.body?.definitionLanguage, 50) || null
        };
        await databaseRun(
            'INSERT INTO word_lists (id, user_id, title, description, term_language, definition_language) VALUES (?, ?, ?, ?, ?, ?)',
            [list.id, list.user_id, list.title, list.description, list.termLanguage, list.definitionLanguage]
        );
        res.status(201).json({ list: { ...list, entry_count: 0, practiced_count: 0, difficult_count: 0 } });
    } catch (error) {
        res.status(500).json({ error: 'Could not create word list' });
    }
});

app.get('/api/word-lists/:id', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const entries = await getWordEntriesWithProgress(list.id, req.user.id);
        res.json({ list, entries });
    } catch (error) {
        res.status(500).json({ error: 'Could not load word list' });
    }
});

app.put('/api/word-lists/:id', authenticateToken, async (req, res) => {
    const title = cleanStudyText(req.body?.title, 120);
    const description = cleanStudyText(req.body?.description, 1000);
    if (!title) return res.status(400).json({ error: 'Geef je woordenlijst een titel' });
    try {
        const result = await databaseRun(
            `UPDATE word_lists SET title = ?, description = ?, term_language = ?, definition_language = ?
             WHERE id = ? AND user_id = ?`,
            [title, description || null, cleanStudyText(req.body?.termLanguage, 50) || null, cleanStudyText(req.body?.definitionLanguage, 50) || null, req.params.id, req.user.id]
        );
        if (!result.changes) return res.status(404).json({ error: 'Word list not found' });
        res.json({ list: await getOwnedWordList(req.params.id, req.user.id) });
    } catch (error) {
        res.status(500).json({ error: 'Could not update word list' });
    }
});

app.delete('/api/word-lists/:id', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun('DELETE FROM word_progress WHERE entry_id IN (SELECT id FROM word_entries WHERE list_id = ?)', [list.id]);
            await databaseRun('DELETE FROM practice_session_entries WHERE session_id IN (SELECT id FROM practice_sessions WHERE list_id = ? AND user_id = ?)', [list.id, req.user.id]);
            await databaseRun('DELETE FROM practice_sessions WHERE list_id = ? AND user_id = ?', [list.id, req.user.id]);
            await databaseRun('DELETE FROM word_entries WHERE list_id = ?', [list.id]);
            await databaseRun('DELETE FROM word_lists WHERE id = ? AND user_id = ?', [list.id, req.user.id]);
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete word list failed:', error.message);
        res.status(500).json({ error: 'Could not delete word list' });
    }
});

app.post('/api/word-lists/:id/entries', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const entry = validateWordEntry(req.body);
        const duplicate = await databaseAll('SELECT id FROM word_entries WHERE list_id = ? AND lower(term) = lower(?)', [list.id, entry.term]);
        if (duplicate.length) return res.status(409).json({ error: 'Deze term staat al in je woordenlijst' });
        const id = uuidv4();
        await databaseRun('INSERT INTO word_entries (id, list_id, term, definition) VALUES (?, ?, ?, ?)', [id, list.id, entry.term, entry.definition]);
        const entries = await getWordEntriesWithProgress(list.id, req.user.id);
        res.status(201).json({ entry: entries.find((item) => item.id === id) });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Could not add word entry' });
    }
});

app.put('/api/word-lists/:id/entries/:entryId', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const entry = validateWordEntry(req.body);
        const duplicate = await databaseAll('SELECT id FROM word_entries WHERE list_id = ? AND lower(term) = lower(?) AND id != ?', [list.id, entry.term, req.params.entryId]);
        if (duplicate.length) return res.status(409).json({ error: 'Deze term staat al in je woordenlijst' });
        const result = await databaseRun('UPDATE word_entries SET term = ?, definition = ? WHERE id = ? AND list_id = ?', [entry.term, entry.definition, req.params.entryId, list.id]);
        if (!result.changes) return res.status(404).json({ error: 'Word entry not found' });
        const entries = await getWordEntriesWithProgress(list.id, req.user.id);
        res.json({ entry: entries.find((item) => item.id === req.params.entryId) });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Could not update word entry' });
    }
});

app.delete('/api/word-lists/:id/entries/:entryId', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const entry = await databaseAll('SELECT id FROM word_entries WHERE id = ? AND list_id = ?', [req.params.entryId, list.id]);
        if (!entry.length) return res.status(404).json({ error: 'Word entry not found' });
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun('DELETE FROM word_progress WHERE user_id = ? AND entry_id = ?', [req.user.id, req.params.entryId]);
            await databaseRun('DELETE FROM practice_session_entries WHERE entry_id = ?', [req.params.entryId]);
            await databaseRun('DELETE FROM word_entries WHERE id = ? AND list_id = ?', [req.params.entryId, list.id]);
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Could not delete word entry' });
    }
});

app.post('/api/word-lists/import', authenticateToken, async (req, res) => {
    const title = cleanStudyText(req.body?.title, 120);
    const description = cleanStudyText(req.body?.description, 1000);
    if (!title) return res.status(400).json({ error: 'Geef de geïmporteerde woordenlijst een titel' });
    if (!Array.isArray(req.body?.entries) || !req.body.entries.length) return res.status(400).json({ error: 'Geen geldige termen gevonden voor import' });
    try {
        const uniqueEntries = new Map();
        req.body.entries.forEach((rawEntry) => {
            const entry = validateWordEntry(rawEntry);
            uniqueEntries.set(normalizedStudyValue(entry.term), entry);
        });
        if (!uniqueEntries.size) throw new Error('Geen geldige termen gevonden voor import');
        const listId = uuidv4();
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun(
                'INSERT INTO word_lists (id, user_id, title, description, term_language, definition_language) VALUES (?, ?, ?, ?, ?, ?)',
                [listId, req.user.id, title, description || null, cleanStudyText(req.body?.termLanguage, 50) || null, cleanStudyText(req.body?.definitionLanguage, 50) || null]
            );
            for (const entry of uniqueEntries.values()) {
                await databaseRun('INSERT INTO word_entries (id, list_id, term, definition) VALUES (?, ?, ?, ?)', [uuidv4(), listId, entry.term, entry.definition]);
            }
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        const list = await getOwnedWordList(listId, req.user.id);
        res.status(201).json({ success: true, list, imported: uniqueEntries.size });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Could not import word list' });
    }
});

app.get('/api/word-lists/:id/progress', authenticateToken, async (req, res) => {
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const entries = await getWordEntriesWithProgress(list.id, req.user.id);
        const summary = entries.reduce((result, entry) => {
            const attempts = Number(entry.correct_count) + Number(entry.wrong_count);
            result.total++;
            if (!attempts) result.unpracticed++;
            else result.practiced++;
            if (Number(entry.wrong_count) > Number(entry.correct_count)) result.difficult++;
            if (attempts >= 3 && Number(entry.correct_count) >= Number(entry.wrong_count) * 2) result.mastered++;
            return result;
        }, { total: 0, practiced: 0, unpracticed: 0, difficult: 0, mastered: 0 });
        res.json({ summary, entries });
    } catch (error) {
        res.status(500).json({ error: 'Could not load progress' });
    }
});

app.post('/api/word-lists/:id/practice/start', authenticateToken, async (req, res) => {
    const method = PRACTICE_METHODS.has(req.body?.method) ? req.body.method : 'test';
    const direction = PRACTICE_DIRECTIONS.has(req.body?.direction) ? req.body.direction : 'term_definition';
    try {
        const list = await getOwnedWordList(req.params.id, req.user.id);
        if (!list) return res.status(404).json({ error: 'Word list not found' });
        const allEntries = await getWordEntriesWithProgress(list.id, req.user.id);
        const selection = normalizePracticeSelection(req.body?.selection);
        let candidates = allEntries;
        if (selection.mode === 'difficult') candidates = allEntries.filter((entry) => Number(entry.wrong_count) > Number(entry.correct_count));
        if (selection.mode === 'unpracticed') candidates = allEntries.filter((entry) => Number(entry.correct_count) + Number(entry.wrong_count) === 0);
        if (selection.mode === 'selected') {
            const ids = new Set(selection.entryIds);
            candidates = allEntries.filter((entry) => ids.has(entry.id));
        }
        if (!candidates.length) return res.status(400).json({ error: 'Geen woorden gevonden voor deze oefenselectie' });
        if (method === 'multiple_choice' && allEntries.length < 4) {
            return res.status(400).json({ error: 'Meerkeuze heeft minimaal vier woorden in de lijst nodig' });
        }
        const requestedCount = selection.count === 'all' ? candidates.length : selection.count === 'auto' ? autoPracticeCount(candidates.length) : Math.max(1, Math.min(200, Math.floor(selection.count)));
        const sessionEntries = pickPracticeEntries(candidates, requestedCount);
        const session = { id: uuidv4(), user_id: req.user.id, list_id: list.id, method, direction };
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun('INSERT INTO practice_sessions (id, user_id, list_id, method, direction) VALUES (?, ?, ?, ?, ?)', [session.id, session.user_id, session.list_id, session.method, session.direction]);
            for (const [position, entry] of sessionEntries.entries()) {
                await databaseRun(
                    'INSERT INTO practice_session_entries (id, session_id, entry_id, position, direction) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), session.id, entry.id, position + 1, resolvePracticeDirection(method, direction)]
                );
            }
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        const question = await buildNextPracticeQuestion(session);
        updateStreak(req.user.id, () => {});
        res.status(201).json({ session: { id: session.id, method, direction, total: sessionEntries.length }, question });
    } catch (error) {
        console.error('❌ Start practice failed:', error.message);
        res.status(500).json({ error: 'Could not start practice session' });
    }
});

app.post('/api/word-lists/:id/practice/submit', authenticateToken, async (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : '';
    if (!sessionId || !entryId) return res.status(400).json({ error: 'Sessie en woord zijn verplicht' });
    try {
        const sessionRows = await databaseAll(
            'SELECT * FROM practice_sessions WHERE id = ? AND user_id = ? AND list_id = ? AND completed_at IS NULL LIMIT 1',
            [sessionId, req.user.id, req.params.id]
        );
        const session = sessionRows[0];
        if (!session) return res.status(404).json({ error: 'Actieve oefensessie niet gevonden' });
        const rows = await databaseAll(
            `SELECT session_entries.*, entries.term, entries.definition FROM practice_session_entries AS session_entries
             JOIN word_entries AS entries ON entries.id = session_entries.entry_id
             WHERE session_entries.session_id = ?
                AND (session_entries.entry_id = ? OR session_entries.id = ?)
                AND session_entries.is_correct IS NULL LIMIT 1`,
            [session.id, entryId, entryId]
        );
        const sessionEntry = rows[0];
        if (!sessionEntry) return res.status(409).json({ error: 'Dit woord is al beantwoord of hoort niet bij deze sessie' });
        const effectiveMethod = session.method === 'mixed' ? 'test' : session.method;
        const expectedAnswer = practiceExpectedAnswer(sessionEntry, sessionEntry.direction, effectiveMethod);
        const correct = effectiveMethod === 'flashcards'
            ? req.body?.known === true
            : answerMatchesStudyValue(req.body?.answer, expectedAnswer);
        await databaseRun('BEGIN TRANSACTION');
        try {
            await databaseRun('UPDATE practice_session_entries SET is_correct = ?, attempts = attempts + 1 WHERE id = ?', [correct ? 1 : 0, sessionEntry.id]);
            await databaseRun(
                `INSERT INTO word_progress (id, user_id, entry_id, correct_count, wrong_count, last_practiced_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id, entry_id) DO UPDATE SET
                    correct_count = word_progress.correct_count + excluded.correct_count,
                    wrong_count = word_progress.wrong_count + excluded.wrong_count,
                    last_practiced_at = CURRENT_TIMESTAMP`,
                [uuidv4(), req.user.id, sessionEntry.entry_id, correct ? 1 : 0, correct ? 0 : 1]
            );
            await databaseRun('COMMIT');
        } catch (transactionError) {
            await databaseRun('ROLLBACK').catch(() => {});
            throw transactionError;
        }
        const nextQuestion = await buildNextPracticeQuestion(session);
        if (!nextQuestion) {
            const result = await buildPracticeResult(session.id);
            await databaseRun('UPDATE practice_sessions SET completed_at = CURRENT_TIMESTAMP, score = ? WHERE id = ?', [result.score, session.id]);
            return res.json({ correct, expectedAnswer, completed: true, result });
        }
        res.json({ correct, expectedAnswer, completed: false, nextQuestion });
    } catch (error) {
        console.error('❌ Submit practice failed:', error.message);
        res.status(500).json({ error: 'Could not save practice answer' });
    }
});

// ---------- FRIENDS ----------
function publicInitials(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

async function getFriendsData(userId) {
    const [friends, incomingRequests, outgoingRequests] = await Promise.all([
        databaseAll(
            `SELECT
                CASE WHEN requests.sender_id = ? THEN receiver.id ELSE sender.id END AS id,
                CASE WHEN requests.sender_id = ? THEN receiver.name ELSE sender.name END AS name,
                CASE WHEN requests.sender_id = ? THEN receiver.plan ELSE sender.plan END AS plan,
                CASE WHEN requests.sender_id = ? THEN receiver.streak ELSE sender.streak END AS streak,
                CASE WHEN requests.sender_id = ? THEN receiver.created_at ELSE sender.created_at END AS joined_at,
                (SELECT COUNT(*) FROM subjects WHERE user_id = CASE WHEN requests.sender_id = ? THEN receiver.id ELSE sender.id END) AS subjects,
                (SELECT ROUND(AVG(grade), 1) FROM subjects WHERE user_id = CASE WHEN requests.sender_id = ? THEN receiver.id ELSE sender.id END AND grade IS NOT NULL) AS average_grade
             FROM friend_requests AS requests
             JOIN users AS sender ON sender.id = requests.sender_id
             JOIN users AS receiver ON receiver.id = requests.receiver_id
             WHERE requests.status = 'accepted' AND (requests.sender_id = ? OR requests.receiver_id = ?)
             ORDER BY name COLLATE NOCASE ASC`,
            [userId, userId, userId, userId, userId, userId, userId, userId, userId]
        ),
        databaseAll(
            `SELECT requests.id, sender.id AS user_id, sender.name, sender.plan, sender.streak
             FROM friend_requests AS requests
             JOIN users AS sender ON sender.id = requests.sender_id
             WHERE requests.receiver_id = ? AND requests.status = 'pending'
             ORDER BY requests.created_at DESC`,
            [userId]
        ),
        databaseAll(
            `SELECT requests.id, receiver.id AS user_id, receiver.name
             FROM friend_requests AS requests
             JOIN users AS receiver ON receiver.id = requests.receiver_id
             WHERE requests.sender_id = ? AND requests.status = 'pending'
             ORDER BY requests.created_at DESC`,
            [userId]
        )
    ]);

    return {
        friends: friends.map((friend) => ({ ...friend, initials: publicInitials(friend.name) })),
        incomingRequests: incomingRequests.map((request) => ({ ...request, initials: publicInitials(request.name) })),
        outgoingRequests
    };
}

app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        res.json(await getFriendsData(req.user.id));
    } catch (error) {
        console.error('❌ Friends fetch failed:', error.message);
        res.status(500).json({ error: 'Could not load friends' });
    }
});

app.post('/api/friends/requests', authenticateToken, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Enter a valid email address' });
    }

    try {
        const recipients = await databaseAll('SELECT id, name FROM users WHERE lower(email) = lower(?) LIMIT 1', [email]);
        const recipient = recipients[0];
        if (!recipient) return res.status(404).json({ error: 'No LifeBuddy account was found with this email address' });
        if (recipient.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself as a friend' });

        const existing = await databaseAll(
            `SELECT id, sender_id, receiver_id, status FROM friend_requests
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.id, recipient.id, recipient.id, req.user.id]
        );
        if (existing.length) {
            const relationship = existing[0];
            if (relationship.status === 'accepted') return res.status(409).json({ error: 'You are already friends' });
            if (relationship.status === 'pending' && relationship.receiver_id === req.user.id) {
                return res.status(409).json({ error: `${recipient.name} has already sent you a request. Accept it in your friends list.` });
            }
            if (relationship.status === 'pending') return res.status(409).json({ error: 'A friend request is already waiting' });
        }

        await databaseRun(
            "INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'pending')",
            [uuidv4(), req.user.id, recipient.id]
        );
        res.status(201).json({ success: true, message: `Friend request sent to ${recipient.name}` });
    } catch (error) {
        console.error('❌ Send friend request failed:', error.message);
        res.status(500).json({ error: 'Could not send the friend request' });
    }
});

app.patch('/api/friends/requests/:id', authenticateToken, async (req, res) => {
    const status = req.body?.status;
    if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Choose accepted or declined' });

    try {
        const result = await databaseRun(
            "UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND receiver_id = ? AND status = 'pending'",
            [status, req.params.id, req.user.id]
        );
        if (!result.changes) return res.status(404).json({ error: 'Friend request not found' });
        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ error: 'Could not update the friend request' });
    }
});

app.get('/api/friends/:friendId/profile', authenticateToken, async (req, res) => {
    try {
        const relationship = await databaseAll(
            `SELECT id FROM friend_requests WHERE status = 'accepted'
             AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) LIMIT 1`,
            [req.user.id, req.params.friendId, req.params.friendId, req.user.id]
        );
        if (!relationship.length) return res.status(403).json({ error: 'You can only view profiles of accepted friends' });

        const profiles = await databaseAll(
            `SELECT u.id, u.name, u.plan, u.streak, u.created_at,
                (SELECT COUNT(*) FROM tasks WHERE user_id = u.id) AS total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE user_id = u.id AND status = 'completed') AS completed_tasks,
                (SELECT COUNT(*) FROM subjects WHERE user_id = u.id) AS subjects,
                (SELECT ROUND(AVG(grade), 1) FROM subjects WHERE user_id = u.id AND grade IS NOT NULL) AS average_grade
             FROM users AS u WHERE u.id = ? LIMIT 1`,
            [req.params.friendId]
        );
        const profile = profiles[0];
        if (!profile) return res.status(404).json({ error: 'Friend profile not found' });
        res.json({ ...profile, initials: publicInitials(profile.name) });
    } catch (error) {
        console.error('❌ Friend profile fetch failed:', error.message);
        res.status(500).json({ error: 'Could not load the friend profile' });
    }
});

// ---------- CHAT (Lokaal via Ollama) ----------
// Streaming answer as newline-delimited JSON: {type:'delta',text} ... {type:'done'} or {type:'error',code,message}.
app.post('/api/chat/stream', authenticateToken, async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 6000) {
        return res.status(400).json({ error: 'Message must contain between 1 and 6000 characters' });
    }
    try {
        await storeUserChatMessage(req.user.id, message);
        updateStreak(req.user.id, (streakError) => {
            if (streakError) console.error('❌ Failed to update chat streak:', streakError.message);
        });
        const messages = await buildChatMessages(req.user.id);

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
        const send = (event) => { if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`); };
        const abort = new AbortController();
        res.on('close', () => { if (!res.writableEnded) abort.abort(); });

        let answer = '';
        try {
            answer = await askOllamaStream(messages, { signal: abort.signal, onDelta: (text) => send({ type: 'delta', text }) });
            if (!answer.trim()) throw new Error('Ollama returned an empty response');
        } catch (error) {
            const partial = String(error.partial || '').trim();
            // A stopped answer keeps what was already shown, so the conversation stays coherent.
            if (partial && (abort.signal.aborted || error.code === 'timeout')) {
                await databaseRun('INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.id, partial, 'assistant']).catch(() => {});
            }
            if (!abort.signal.aborted) {
                console.error('❌ AI Error:', error.message);
                send({ type: 'error', ...chatErrorPayload(error) });
            }
            return res.end();
        }
        await databaseRun('INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.id, answer.trim(), 'assistant']);
        send({ type: 'done' });
        res.end();
    } catch (error) {
        console.error('❌ Chat stream failed:', error.message);
        if (!res.headersSent) return res.status(500).json({ error: 'Could not start chat' });
        res.end();
    }
});

// Non-streaming variant, kept for simple clients. Errors are never stored as conversation messages.
app.post('/api/chat', authenticateToken, async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 6000) {
        return res.status(400).json({ error: 'Message must contain between 1 and 6000 characters' });
    }
    try {
        await storeUserChatMessage(req.user.id, message);
        updateStreak(req.user.id, (streakError) => {
            if (streakError) console.error('❌ Failed to update chat streak:', streakError.message);
        });
        const aiResponse = await askOllama(await buildChatMessages(req.user.id));
        await databaseRun('INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.id, aiResponse, 'assistant']);
        const history = await databaseAll('SELECT message, role, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?', [req.user.id, 100]);
        res.json({ response: aiResponse, history: history.reverse(), historyLimited: history.length === 100 });
    } catch (error) {
        console.error('❌ AI Error:', error.message);
        res.status(503).json({ error: chatErrorPayload(error).message });
    }
});

app.get('/api/chat/history', authenticateToken, (req, res) => {
    const limit = 100;

    db.all(
        'SELECT message, role, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?',
        [req.user.id, limit],
        (err, history) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch history' });
            }
            res.json({ history: history.reverse(), historyLimited: history.length === limit });
        }
    );
});

// ---------- STATS ----------
app.get('/api/stats', authenticateToken, (req, res) => {
    db.get(
        `SELECT
            (SELECT COUNT(*) FROM tasks WHERE user_id = users.id AND status != 'completed') AS tasks,
            (SELECT COUNT(*) FROM tasks WHERE user_id = users.id) AS totalTasks,
            (SELECT COUNT(*) FROM tasks WHERE user_id = users.id AND status = 'completed') AS completedTasks,
            (SELECT COUNT(*) FROM subjects WHERE user_id = users.id) AS subjects,
            (SELECT ROUND(AVG(grade), 1) FROM subjects WHERE user_id = users.id AND grade IS NOT NULL) AS averageGrade,
            (SELECT COUNT(*) FROM chat_history WHERE user_id = users.id AND role = 'assistant') AS chats,
            streak,
            last_study_date
         FROM users WHERE id = ?`,
        [req.user.id],
        (err, stats) => {
            if (err || !stats) {
                return res.status(500).json({ error: 'Failed to fetch statistics' });
            }

            res.json({
                ...stats,
                tasks: stats.tasks || 0,
                totalTasks: stats.totalTasks || 0,
                completedTasks: stats.completedTasks || 0,
                subjects: stats.subjects || 0,
                chats: stats.chats || 0,
                streak: stats.streak || 0,
                plan: req.user.plan
            });
        }
    );
});

// ---------- TEST AI ENDPOINT ----------
app.get('/api/test-ai', authenticateToken, async (req, res) => {
    try {
        const answer = await askOllama([
            { role: 'system', content: OLLAMA_SYSTEM_PROMPT },
            { role: 'user', content: 'Zeg hallo in het Nederlands.' }
        ], 50);

        res.json({ 
            success: true, 
            provider: 'ollama',
            model: OLLAMA_MODEL,
            response: answer
        });
    } catch (error) {
        console.error('❌ Test AI Error:', error.message);
        res.json({ 
            success: false, 
            error: error.message
        });
    }
});

// Return JSON for mistyped API URLs instead of silently serving the landing page.
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// ============================================================
// SERVE PAGES
// ============================================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/music', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'music.html'));
});

app.get('/studieruimte', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'studieruimte.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ============================================================
// START SERVER
// ============================================================
const server = app.listen(PORT, () => {
    console.log(`🚀 LifeBuddy server running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${process.env.DATABASE_PATH || './database/lifebuddy.db'}`);
    console.log(`🤖 AI Model: ${OLLAMA_MODEL} (via lokale Ollama)`);
    console.log(`💬 Ollama URL: ${OLLAMA_BASE_URL}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other LifeBuddy server or start this one with another PORT.`);
        process.exitCode = 1;
        return;
    }
    throw error;
});
