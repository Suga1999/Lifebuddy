const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');  // ← DIT IS DE FIX!
const { v4: uuidv4 } = require('uuid');
const db = require('../server');

// ============================================================
// MIDDLEWARE: Authenticate
// ============================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ JWT Error:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ============================================================
// GET PROFILE
// ============================================================
router.get('/profile', authenticateToken, (req, res) => {
  console.log('📊 Profile request for user:', req.user.id);
  
  db.get('SELECT id, email, name, plan FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('❌ Database error:', err.message);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    
    if (!user) {
      console.log('❌ User not found:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ User found:', user);
    res.json(user);
  });
});

// ============================================================
// UPDATE PROFILE
// ============================================================
router.put('/profile', authenticateToken, (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id], function(err) {
    if (err) {
      console.error('❌ Update error:', err.message);
      return res.status(500).json({ error: 'Update failed: ' + err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, name });
  });
});

// ============================================================
// GET STATS
// ============================================================
router.get('/stats', authenticateToken, (req, res) => {
  db.get(
    'SELECT COUNT(*) as taskCount FROM tasks WHERE user_id = ? AND status != "completed"',
    [req.user.id],
    (err, taskResult) => {
      if (err) {
        console.error('❌ Stats error:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.get(
        'SELECT COUNT(*) as subjectCount FROM subjects WHERE user_id = ?',
        [req.user.id],
        (err, subjectResult) => {
          db.get(
            'SELECT COUNT(*) as chatCount FROM chat_history WHERE user_id = ? AND role = "assistant"',
            [req.user.id],
            (err, chatResult) => {
              res.json({
                tasks: taskResult?.taskCount || 0,
                subjects: subjectResult?.subjectCount || 0,
                chats: chatResult?.chatCount || 0,
                plan: req.user.plan
              });
            }
          );
        }
      );
    }
  );
});

// ============================================================
// GET ALL TASKS
// ============================================================
router.get('/tasks', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC',
    [req.user.id],
    (err, tasks) => {
      if (err) {
        console.error('❌ Tasks error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }
      res.json(tasks);
    }
  );
});

// ============================================================
// CREATE TASK
// ============================================================
router.post('/tasks', authenticateToken, (req, res) => {
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
          console.error('❌ Create task error:', err.message);
          return res.status(500).json({ error: 'Failed to create task' });
        }
        db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
          res.json(task);
        });
      }
    );
  }

  // Check plan limits for free users
  if (req.user.plan === 'free') {
    db.get(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != "completed"',
      [req.user.id],
      (err, result) => {
        if (err) {
          console.error('❌ Check limit error:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.count >= 5) {
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

// ============================================================
// UPDATE TASK
// ============================================================
router.put('/tasks/:id', authenticateToken, (req, res) => {
  const { title, description, due_date, status } = req.body;
  const taskId = req.params.id;

  db.run(
    'UPDATE tasks SET title = ?, description = ?, due_date = ?, status = ? WHERE id = ? AND user_id = ?',
    [title, description || '', due_date || null, status || 'pending', taskId, req.user.id],
    function(err) {
      if (err) {
        console.error('❌ Update task error:', err.message);
        return res.status(500).json({ error: 'Failed to update task' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found or unauthorized' });
      }
      
      db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        res.json(task);
      });
    }
  );
});

// ============================================================
// DELETE TASK
// ============================================================
router.delete('/tasks/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        console.error('❌ Delete task error:', err.message);
        return res.status(500).json({ error: 'Failed to delete task' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Task not found or unauthorized' });
      }
      
      res.json({ success: true });
    }
  );
});

// ============================================================
// GET ALL SUBJECTS
// ============================================================
router.get('/subjects', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM subjects WHERE user_id = ?',
    [req.user.id],
    (err, subjects) => {
      if (err) {
        console.error('❌ Subjects error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch subjects' });
      }
      res.json(subjects);
    }
  );
});

// ============================================================
// CREATE SUBJECT
// ============================================================
router.post('/subjects', authenticateToken, (req, res) => {
  const { name, grade } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }

  function createSubject() {
    const id = uuidv4();
    db.run(
      'INSERT INTO subjects (id, user_id, name, grade) VALUES (?, ?, ?, ?)',
      [id, req.user.id, name, grade || null],
      function(err) {
        if (err) {
          console.error('❌ Create subject error:', err.message);
          return res.status(500).json({ error: 'Failed to create subject' });
        }
        db.get('SELECT * FROM subjects WHERE id = ?', [id], (err, subject) => {
          res.json(subject);
        });
      }
    );
  }

  // Check plan limits for free users
  if (req.user.plan === 'free') {
    db.get(
      'SELECT COUNT(*) as count FROM subjects WHERE user_id = ?',
      [req.user.id],
      (err, result) => {
        if (err) {
          console.error('❌ Check limit error:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.count >= 5) {
          return res.status(403).json({
            error: 'Free plan limited to 5 subjects. Upgrade to Pro for unlimited.'
          });
        }
        createSubject();
      }
    );
  } else {
    createSubject();
  }
});

// ============================================================
// DELETE SUBJECT
// ============================================================
router.delete('/subjects/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM subjects WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        console.error('❌ Delete subject error:', err.message);
        return res.status(500).json({ error: 'Failed to delete subject' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Subject not found or unauthorized' });
      }
      
      res.json({ success: true });
    }
  );
});

module.exports = router;