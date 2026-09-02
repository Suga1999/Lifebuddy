const express = require('express');
const router = express.Router();
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
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ============================================================
// SEND MESSAGE
// ============================================================
router.post('/', authenticateToken, (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const isPro = req.user.plan === 'pro';

  // Save user message
  const msgId = uuidv4();
  db.run(
    'INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)',
    [msgId, req.user.id, message, 'user']
  );

  // Generate AI response (mock)
  const aiResponses = [
    "Dat klinkt als een goede stap! Hoe voel je je daarbij?",
    "Interessant! Wat denk je dat je zou helpen om dit te bereiken?",
    "Ik hoor je. Laten we samen een plan maken. Wat is de eerste stap?",
    "Goed dat je hierover nadenkt. Heb je al eerder iets soortgelijks geprobeerd?",
    "Wat een mooi doel! Hoe zou je het liefst beginnen?",
    "Ik snap het. Soms is het lastig om te weten waar te beginnen. Laten we het opsplitsen.",
    "Dat is een goede vraag! Laten we het stap voor stap bekijken.",
    "Ik denk dat je hier echt mee vooruit kunt komen. Wat is de kleinste stap die je nu kunt zetten?",
    "Herkenbaar! Veel studenten hebben hier mee te maken. Wat zou je willen veranderen?",
    "Super dat je dit deelt! Hoe kan ik je het beste ondersteunen?"
  ];
  const aiResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];

  // Save AI response
  const aiId = uuidv4();
  db.run(
    'INSERT INTO chat_history (id, user_id, message, role) VALUES (?, ?, ?, ?)',
    [aiId, req.user.id, aiResponse, 'assistant']
  );

  // Get chat history (limited based on plan)
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
});

// ============================================================
// GET CHAT HISTORY
// ============================================================
router.get('/history', authenticateToken, (req, res) => {
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

// ============================================================
// CLEAR CHAT (Pro only)
// ============================================================
router.delete('/clear', authenticateToken, (req, res) => {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({ error: 'Clear chat is a Pro feature' });
  }

  db.run(
    'DELETE FROM chat_history WHERE user_id = ?',
    [req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to clear chat' });
      }
      res.json({ success: true, message: 'Chat history cleared' });
    }
  );
});

module.exports = router;