const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM metadata_repository';
    const params = [];

    if (search) {
      query += ' WHERE table_name ILIKE $1 OR column_name ILIKE $1 OR description ILIKE $1 OR business_definition ILIKE $1 OR technical_owner ILIKE $1 OR business_owner ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Metadata list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM metadata_repository WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metadata entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Metadata get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, data_type, description, business_definition, technical_owner, business_owner, tags } = req.body;

    if (!table_name) {
      return res.status(400).json({ error: 'table_name is required' });
    }

    const result = await pool.query(
      `INSERT INTO metadata_repository (table_name, column_name, data_type, description, business_definition, technical_owner, business_owner, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [table_name, column_name || null, data_type || null, description || null, business_definition || null, technical_owner || null, business_owner || null, tags || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Metadata create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, data_type, description, business_definition, technical_owner, business_owner, tags } = req.body;

    const result = await pool.query(
      `UPDATE metadata_repository SET table_name = COALESCE($1, table_name), column_name = COALESCE($2, column_name),
       data_type = COALESCE($3, data_type), description = COALESCE($4, description),
       business_definition = COALESCE($5, business_definition), technical_owner = COALESCE($6, technical_owner),
       business_owner = COALESCE($7, business_owner), tags = COALESCE($8, tags), last_updated = NOW()
       WHERE id = $9 RETURNING *`,
      [table_name, column_name, data_type, description, business_definition, technical_owner, business_owner, tags, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metadata entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Metadata update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM metadata_repository WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metadata entry not found' });
    }
    res.json({ message: 'Metadata entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Metadata delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
