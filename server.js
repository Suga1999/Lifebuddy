const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject_id, label),
            FOREIGN KEY (subject_id) REFERENCES subjects(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (error) => {
        if (error) {
            console.error('❌ Grade entries table migration failed:', error.message);
            return;
        }
        db.run('CREATE INDEX IF NOT EXISTS idx_grade_entries_subject_id ON grade_entries(subject_id)', (indexError) => {
            if (indexError) console.error('❌ Grade entries index migration failed:', indexError.message);
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

    console.log('✅ Database tables ready');
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

function parseGradeEntries(rawGrades, fallbackGrade, fallbackLabel = 'Cijfer') {
    const input = Array.isArray(rawGrades)
        ? rawGrades
        : fallbackGrade === null || fallbackGrade === undefined || fallbackGrade === ''
            ? []
            : [{ label: fallbackLabel, grade: fallbackGrade }];
    const entries = new Map();

    for (const rawEntry of input) {
        const grade = Number(rawEntry?.grade);
        const label = normalizeGradeLabel(rawEntry?.label, fallbackLabel);
        if (!Number.isFinite(grade) || grade < 0 || grade > 10) {
            throw new Error('Every grade must be a number between 0 and 10');
        }
        entries.set(normalizeSubjectName(label), { label, grade: Math.round(grade * 10) / 10 });
    }

    return [...entries.values()];
}

function averageGrade(entries) {
    if (!entries.length) return null;
    return Math.round((entries.reduce((total, entry) => total + entry.grade, 0) / entries.length) * 10) / 10;
}

async function ensureLegacyGradeEntry(subject) {
    if (subject.grade === null || subject.grade === undefined) return;
    const entries = await databaseAll('SELECT id FROM grade_entries WHERE subject_id = ? LIMIT 1', [subject.id]);
    if (!entries.length) {
        await databaseRun(
            'INSERT INTO grade_entries (id, subject_id, user_id, label, grade) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), subject.id, subject.user_id, 'Eerder cijfer', subject.grade]
        );
    }
}

async function buildSubjectsWithGrades(userId) {
    const [subjects, entries] = await Promise.all([
        databaseAll('SELECT * FROM subjects WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC', [userId]),
        databaseAll('SELECT subject_id, label, grade FROM grade_entries WHERE user_id = ? ORDER BY created_at ASC, label COLLATE NOCASE ASC', [userId])
    ]);
    const entriesBySubject = new Map();
    entries.forEach((entry) => {
        const current = entriesBySubject.get(entry.subject_id) || [];
        current.push({ label: entry.label, grade: entry.grade });
        entriesBySubject.set(entry.subject_id, current);
    });

    return subjects.map((subject) => {
        const grades = entriesBySubject.get(subject.id) || (subject.grade === null || subject.grade === undefined ? [] : [{ label: 'Eerder cijfer', grade: subject.grade }]);
        return { ...subject, grade: averageGrade(grades), grades };
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

// ============================================================
// API ROUTES
// ============================================================

// ---------- AUTH ----------
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        db.run(
            'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
            [userId, email, hashedPassword, name || email.split('@')[0]],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Registration failed' });
                }

                const token = jwt.sign(
                    { id: userId, email, plan: 'free' },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.json({
                    token,
                    user: { id: userId, email, name: name || email.split('@')[0], plan: 'free' }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
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
    const { name } = req.body;
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

app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, description, due_date } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title required' });
    }

    function createTask() {
        const id = uuidv4();
        db.run(
            'INSERT INTO tasks (id, user_id, title, description, due_date) VALUES (?, ?, ?, ?, ?)',
            [id, req.user.id, title, description || '', due_date || null],
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

    if (req.user.plan === 'free') {
        db.get(
            'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != "completed"',
            [req.user.id],
            (err, result) => {
                if (err || result.count >= 5) {
                    return res.status(403).json({
                        error: 'Free plan limited to 5 active tasks. Upgrade to Pro for unlimited.'
                    });
                }
                createTask();
            }
        );
    } else {
        createTask();
    }
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { title, description, due_date, status } = req.body;
    const taskId = req.params.id;

    db.run(
        'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ? WHERE id = ? AND user_id = ?',
        [title, description || '', due_date || null, status || 'pending', taskId, req.user.id],
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
    );
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
        subject = { id: uuidv4(), user_id: userId, name, grade: null };
        await databaseRun('INSERT INTO subjects (id, user_id, name, grade) VALUES (?, ?, ?, ?)', [subject.id, userId, name, null]);
        created = true;
    }

    for (const entry of grades) {
        await databaseRun(
            `INSERT INTO grade_entries (id, subject_id, user_id, label, grade)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(subject_id, label) DO UPDATE SET grade = excluded.grade`,
            [uuidv4(), subject.id, userId, entry.label, entry.grade]
        );
    }

    const savedEntries = await databaseAll('SELECT label, grade FROM grade_entries WHERE subject_id = ? ORDER BY created_at ASC, label COLLATE NOCASE ASC', [subject.id]);
    const average = averageGrade(savedEntries);
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

// ---------- DELETE ALL SUBJECTS ----------
app.delete('/api/subjects', authenticateToken, async (req, res) => {
    try {
        await databaseRun('BEGIN TRANSACTION');
        try {
            const result = await databaseRun('DELETE FROM subjects WHERE user_id = ?', [req.user.id]);
            await databaseRun('DELETE FROM grade_entries WHERE user_id = ?', [req.user.id]);
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

// ---------- CHAT (Met Groq AI) ----------
app.post('/api/chat', authenticateToken, async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    const isPro = req.user.plan === 'pro';

    // Sla gebruikersbericht op
    const msgId = uuidv4();
    db.run(
        'INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)',
        [msgId, req.user.id, message, 'user']
    );
    updateStreak(req.user.id, (streakError) => {
        if (streakError) console.error('❌ Failed to update chat streak:', streakError.message);
    });

    try {
        // Initialize Groq client
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Je bent een behulpzame studie-assistent die ALTIJD in het Nederlands antwoordt. Geef korte, praktische antwoorden."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 150,
            top_p: 1,
            stream: false
        });

        const aiResponse = completion.choices[0]?.message?.content || "Ik begrijp het niet helemaal. Kun je het anders vragen?";

        // Sla AI-antwoord op
        const aiId = uuidv4();
        db.run(
            'INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)',
            [aiId, req.user.id, aiResponse, 'assistant']
        );

        // Haal geschiedenis op
        const historyLimit = isPro ? 50 : 10;
        db.all(
            'SELECT message, role, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
            [req.user.id, historyLimit],
            (err, history) => {
                if (err) {
                    return res.json({ response: aiResponse, history: [] });
                }
                res.json({
                    response: aiResponse,
                    history: history.reverse(),
                    isPro
                });
            }
        );
    } catch (error) {
        console.error('❌ AI Error:', error.message);
        
        // Fallback als Groq niet werkt
        const fallbackResponse = "De AI-assistent is momenteel niet beschikbaar. Probeer het later opnieuw. 📚";
        const aiId = uuidv4();
        db.run(
            'INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)',
            [aiId, req.user.id, fallbackResponse, 'assistant']
        );

        const historyLimit = isPro ? 50 : 10;
        db.all(
            'SELECT message, role, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
            [req.user.id, historyLimit],
            (err, history) => {
                res.json({
                    response: fallbackResponse,
                    history: history ? history.reverse() : [],
                    isPro
                });
            }
        );
    }
});

app.get('/api/chat/history', authenticateToken, (req, res) => {
    const isPro = req.user.plan === 'pro';
    const limit = isPro ? 100 : 10;

    db.all(
        'SELECT message, role, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
        [req.user.id, limit],
        (err, history) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch history' });
            }
            res.json({ history: history.reverse(), isPro });
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

// ---------- SUBSCRIPTION ----------
app.post('/api/subscription/upgrade', authenticateToken, (req, res) => {
    db.run(
        'UPDATE users SET plan = ? WHERE id = ?',
        ['pro', req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Upgrade failed' });
            }

            const token = jwt.sign(
                { id: req.user.id, email: req.user.email, plan: 'pro' },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                plan: 'pro',
                token
            });
        }
    );
});

// ---------- TEST AI ENDPOINT ----------
app.get('/api/test-ai', async (req, res) => {
    try {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: "Zeg hallo in het Nederlands"
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 50,
        });

        res.json({ 
            success: true, 
            response: completion.choices[0]?.message?.content || 'Geen antwoord'
        });
    } catch (error) {
        console.error('❌ Test AI Error:', error.message);
        res.json({ 
            success: false, 
            error: error.message
        });
    }
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 LifeBuddy server running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${process.env.DATABASE_PATH || './database/lifebuddy.db'}`);
    console.log(`🤖 AI Model: Mixtral-8x7B (via Groq Cloud)`);
    console.log(`✅ Groq AI is configured!`);
});
