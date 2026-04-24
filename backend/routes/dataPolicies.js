const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_policies';
    const params = [];

    if (search) {
      query += ' WHERE policy_name ILIKE $1 OR category ILIKE $1 OR description ILIKE $1 OR scope ILIKE $1 OR owner ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data policies list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_policies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data policy not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data policy get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { policy_name, category, description, scope, enforcement_level, status, effective_date, review_date, owner } = req.body;

    if (!policy_name || !category) {
      return res.status(400).json({ error: 'policy_name and category are required' });
    }

    const result = await pool.query(
      `INSERT INTO data_policies (policy_name, category, description, scope, enforcement_level, status, effective_date, review_date, owner)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [policy_name, category, description || null, scope || null, enforcement_level || 'mandatory', status || 'active', effective_date || null, review_date || null, owner || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data policy create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { policy_name, category, description, scope, enforcement_level, status, effective_date, review_date, owner } = req.body;

    const result = await pool.query(
      `UPDATE data_policies SET policy_name = COALESCE($1, policy_name), category = COALESCE($2, category),
       description = COALESCE($3, description), scope = COALESCE($4, scope),
       enforcement_level = COALESCE($5, enforcement_level), status = COALESCE($6, status),
       effective_date = COALESCE($7, effective_date), review_date = COALESCE($8, review_date),
       owner = COALESCE($9, owner)
       WHERE id = $10 RETURNING *`,
      [policy_name, category, description, scope, enforcement_level, status, effective_date, review_date, owner, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data policy not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data policy update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_policies WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data policy not found' });
    }
    res.json({ message: 'Data policy deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data policy delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
