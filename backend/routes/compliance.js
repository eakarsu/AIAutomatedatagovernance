const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM compliance_records';
    const params = [];

    if (search) {
      query += ' WHERE regulation ILIKE $1 OR requirement ILIKE $1 OR status ILIKE $1 OR responsible_party ILIKE $1 OR risk_level ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Compliance list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compliance_records WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Compliance get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { regulation, requirement, status, evidence, risk_level, responsible_party, due_date, last_assessed, notes } = req.body;

    if (!regulation || !requirement) {
      return res.status(400).json({ error: 'regulation and requirement are required' });
    }

    const result = await pool.query(
      `INSERT INTO compliance_records (regulation, requirement, status, evidence, risk_level, responsible_party, due_date, last_assessed, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [regulation, requirement, status || 'in_progress', evidence || null, risk_level || null, responsible_party || null, due_date || null, last_assessed || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Compliance create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { regulation, requirement, status, evidence, risk_level, responsible_party, due_date, last_assessed, notes } = req.body;

    const result = await pool.query(
      `UPDATE compliance_records SET regulation = COALESCE($1, regulation), requirement = COALESCE($2, requirement),
       status = COALESCE($3, status), evidence = COALESCE($4, evidence),
       risk_level = COALESCE($5, risk_level), responsible_party = COALESCE($6, responsible_party),
       due_date = COALESCE($7, due_date), last_assessed = COALESCE($8, last_assessed),
       notes = COALESCE($9, notes)
       WHERE id = $10 RETURNING *`,
      [regulation, requirement, status, evidence, risk_level, responsible_party, due_date, last_assessed, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Compliance update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM compliance_records WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance record not found' });
    }
    res.json({ message: 'Compliance record deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Compliance delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
