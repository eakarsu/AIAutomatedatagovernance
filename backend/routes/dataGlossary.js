const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_glossary';
    const params = [];

    if (search) {
      query += ' WHERE term ILIKE $1 OR definition ILIKE $1 OR category ILIKE $1 OR domain ILIKE $1 OR owner ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data glossary list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_glossary WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data glossary entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data glossary get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { term, definition, category, synonyms, related_terms, domain, owner, status } = req.body;

    if (!term || !definition) {
      return res.status(400).json({ error: 'term and definition are required' });
    }

    const result = await pool.query(
      `INSERT INTO data_glossary (term, definition, category, synonyms, related_terms, domain, owner, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [term, definition, category || null, synonyms || null, related_terms || null, domain || null, owner || null, status || 'approved']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data glossary create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { term, definition, category, synonyms, related_terms, domain, owner, status } = req.body;

    const result = await pool.query(
      `UPDATE data_glossary SET term = COALESCE($1, term), definition = COALESCE($2, definition),
       category = COALESCE($3, category), synonyms = COALESCE($4, synonyms),
       related_terms = COALESCE($5, related_terms), domain = COALESCE($6, domain),
       owner = COALESCE($7, owner), status = COALESCE($8, status), updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [term, definition, category, synonyms, related_terms, domain, owner, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data glossary entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data glossary update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_glossary WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data glossary entry not found' });
    }
    res.json({ message: 'Data glossary entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data glossary delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
