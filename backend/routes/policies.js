const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// Ensure data_policies has retention_date and expired_status columns
async function ensureRetentionColumns() {
  await pool.query(`
    ALTER TABLE data_policies
    ADD COLUMN IF NOT EXISTS retention_date DATE,
    ADD COLUMN IF NOT EXISTS expired_status BOOLEAN DEFAULT false
  `);
}

ensureRetentionColumns().catch((err) => console.error('Retention columns init error:', err));

// POST /api/policies/enforce
// Checks all data_policies where retention_date < now(), marks them as expired, returns list
router.post('/enforce', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE data_policies
      SET expired_status = true, status = 'expired'
      WHERE retention_date IS NOT NULL
        AND retention_date < NOW()::DATE
        AND (expired_status = false OR expired_status IS NULL)
      RETURNING *
    `);

    res.json({
      enforced_at: new Date().toISOString(),
      total_expired: result.rows.length,
      expired_policies: result.rows,
    });
  } catch (err) {
    console.error('Policy enforce error:', err);
    res.status(500).json({ error: 'Failed to enforce retention policies', details: err.message });
  }
});

// GET /api/policies/upcoming-expirations?days=30
// Returns data assets / policies expiring within N days
router.get('/upcoming-expirations', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;

    if (days < 0 || days > 3650) {
      return res.status(400).json({ error: 'days must be between 0 and 3650' });
    }

    const result = await pool.query(
      `SELECT *
       FROM data_policies
       WHERE retention_date IS NOT NULL
         AND retention_date >= NOW()::DATE
         AND retention_date <= (NOW() + ($1 || ' days')::INTERVAL)::DATE
         AND (expired_status = false OR expired_status IS NULL)
       ORDER BY retention_date ASC`,
      [days]
    );

    res.json({
      as_of: new Date().toISOString(),
      days_ahead: days,
      total: result.rows.length,
      upcoming_expirations: result.rows,
    });
  } catch (err) {
    console.error('Upcoming expirations error:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming expirations', details: err.message });
  }
});

module.exports = router;
