const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_quality_rules';
    const params = [];

    if (search) {
      query += ' WHERE rule_name ILIKE $1 OR table_name ILIKE $1 OR column_name ILIKE $1 OR rule_type ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data quality list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_quality_rules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data quality rule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data quality get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rule_name, table_name, column_name, rule_type, rule_expression, threshold, current_score, status, last_checked } = req.body;

    if (!rule_name || !rule_type) {
      return res.status(400).json({ error: 'rule_name and rule_type are required' });
    }

    const result = await pool.query(
      `INSERT INTO data_quality_rules (rule_name, table_name, column_name, rule_type, rule_expression, threshold, current_score, status, last_checked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [rule_name, table_name || null, column_name || null, rule_type, rule_expression || null, threshold || null, current_score || null, status || 'active', last_checked || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data quality create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { rule_name, table_name, column_name, rule_type, rule_expression, threshold, current_score, status, last_checked } = req.body;

    const result = await pool.query(
      `UPDATE data_quality_rules SET rule_name = COALESCE($1, rule_name), table_name = COALESCE($2, table_name),
       column_name = COALESCE($3, column_name), rule_type = COALESCE($4, rule_type),
       rule_expression = COALESCE($5, rule_expression), threshold = COALESCE($6, threshold),
       current_score = COALESCE($7, current_score), status = COALESCE($8, status),
       last_checked = COALESCE($9, last_checked)
       WHERE id = $10 RETURNING *`,
      [rule_name, table_name, column_name, rule_type, rule_expression, threshold, current_score, status, last_checked, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data quality rule not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data quality update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_quality_rules WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data quality rule not found' });
    }
    res.json({ message: 'Data quality rule deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data quality delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
