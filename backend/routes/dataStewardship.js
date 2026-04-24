const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_stewards';
    const params = [];

    if (search) {
      query += ' WHERE steward_name ILIKE $1 OR email ILIKE $1 OR department ILIKE $1 OR domain ILIKE $1 OR responsibility_area ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data stewardship list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_stewards WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data steward not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data steward get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { steward_name, email, department, domain, responsibility_area, tables_managed, status, assigned_date, last_review } = req.body;

    if (!steward_name) {
      return res.status(400).json({ error: 'steward_name is required' });
    }

    const result = await pool.query(
      `INSERT INTO data_stewards (steward_name, email, department, domain, responsibility_area, tables_managed, status, assigned_date, last_review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [steward_name, email || null, department || null, domain || null, responsibility_area || null, tables_managed || null, status || 'active', assigned_date || null, last_review || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data steward create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { steward_name, email, department, domain, responsibility_area, tables_managed, status, assigned_date, last_review } = req.body;

    const result = await pool.query(
      `UPDATE data_stewards SET steward_name = COALESCE($1, steward_name), email = COALESCE($2, email),
       department = COALESCE($3, department), domain = COALESCE($4, domain),
       responsibility_area = COALESCE($5, responsibility_area), tables_managed = COALESCE($6, tables_managed),
       status = COALESCE($7, status), assigned_date = COALESCE($8, assigned_date),
       last_review = COALESCE($9, last_review)
       WHERE id = $10 RETURNING *`,
      [steward_name, email, department, domain, responsibility_area, tables_managed, status, assigned_date, last_review, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data steward not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data steward update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_stewards WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data steward not found' });
    }
    res.json({ message: 'Data steward deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data steward delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
