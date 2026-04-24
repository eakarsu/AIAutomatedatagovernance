const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM audit_logs';
    const params = [];

    if (search) {
      query += ' WHERE action ILIKE $1 OR entity_type ILIKE $1 OR entity_name ILIKE $1 OR performed_by ILIKE $1 OR details ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Audit logs list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Audit log get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create audit log entry (from other services)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { action, entity_type, entity_id, entity_name, performed_by, details, ip_address, status } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const result = await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, performed_by, details, ip_address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [action, entity_type || null, entity_id || null, entity_name || null, performed_by || null, details || null, ip_address || null, status || 'success']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Audit log create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
