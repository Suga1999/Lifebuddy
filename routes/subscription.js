const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
// UPGRADE TO PRO
// ============================================================
router.post('/upgrade', authenticateToken, (req, res) => {
  // In production: Integrate with Stripe
  // For demo: Simulate successful upgrade

  db.run(
    'UPDATE users SET plan = ? WHERE id = ?',
    ['pro', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Upgrade failed: ' + err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate new token with updated plan
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          plan: 'pro' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        plan: 'pro',
        token,
        message: 'Successfully upgraded to Pro! 🎉'
      });
    }
  );
});

// ============================================================
// DOWNGRADE TO FREE
// ============================================================
router.post('/downgrade', authenticateToken, (req, res) => {
  db.run(
    'UPDATE users SET plan = ? WHERE id = ?',
    ['free', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Downgrade failed: ' + err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate new token with updated plan
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          plan: 'free' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        plan: 'free',
        token,
        message: 'Downgraded to Free plan'
      });
    }
  );
});

// ============================================================
// GET CURRENT PLAN
// ============================================================
router.get('/plan', authenticateToken, (req, res) => {
  db.get('SELECT plan FROM users WHERE id = ?', [req.user.id], (err, result) => {
    if (err || !result) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ plan: result.plan });
  });
});

// ============================================================
// CHECK FEATURE ACCESS
// ============================================================
router.post('/check-feature', authenticateToken, (req, res) => {
  const { feature } = req.body;
  
  const proFeatures = ['music', 'unlimited_tasks', 'unlimited_subjects', 'full_chat_history'];
  
  if (proFeatures.includes(feature)) {
    const hasAccess = req.user.plan === 'pro';
    res.json({
      feature,
      hasAccess,
      plan: req.user.plan,
      message: hasAccess ? 'Access granted' : 'Upgrade to Pro for this feature'
    });
  } else {
    res.json({
      feature,
      hasAccess: true,
      plan: req.user.plan,
      message: 'Feature available for all plans'
    });
  }
});

// ============================================================
// SIMULATE PAYMENT (for demo)
// ============================================================
router.post('/payment-simulate', authenticateToken, (req, res) => {
  const { paymentMethod } = req.body;
  
  // Simulate payment processing
  if (paymentMethod === 'credit_card') {
    // Simulate success
    setTimeout(() => {
      res.json({
        success: true,
        message: 'Payment successful! 🎉',
        transactionId: 'demo_' + Date.now()
      });
    }, 1000);
  } else {
    res.status(400).json({
      success: false,
      error: 'Invalid payment method'
    });
  }
});

module.exports = router;