const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_classification';
    const params = [];

    if (search) {
      query += ' WHERE table_name ILIKE $1 OR column_name ILIKE $1 OR classification_level ILIKE $1 OR classified_by ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data classification list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_classification WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data classification entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data classification get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, classification_level, data_type, pii_flag, phi_flag, pci_flag, classified_by, classification_method, confidence_score } = req.body;

    if (!table_name || !column_name || !classification_level) {
      return res.status(400).json({ error: 'table_name, column_name, and classification_level are required' });
    }

    const result = await pool.query(
      `INSERT INTO data_classification (table_name, column_name, classification_level, data_type, pii_flag, phi_flag, pci_flag, classified_by, classification_method, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [table_name, column_name, classification_level, data_type || null, pii_flag || false, phi_flag || false, pci_flag || false, classified_by || null, classification_method || null, confidence_score || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data classification create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, classification_level, data_type, pii_flag, phi_flag, pci_flag, classified_by, classification_method, confidence_score } = req.body;

    const result = await pool.query(
      `UPDATE data_classification SET table_name = COALESCE($1, table_name), column_name = COALESCE($2, column_name),
       classification_level = COALESCE($3, classification_level), data_type = COALESCE($4, data_type),
       pii_flag = COALESCE($5, pii_flag), phi_flag = COALESCE($6, phi_flag), pci_flag = COALESCE($7, pci_flag),
       classified_by = COALESCE($8, classified_by), classification_method = COALESCE($9, classification_method),
       confidence_score = COALESCE($10, confidence_score), updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [table_name, column_name, classification_level, data_type, pii_flag, phi_flag, pci_flag, classified_by, classification_method, confidence_score, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data classification entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data classification update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_classification WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data classification entry not found' });
    }
    res.json({ message: 'Data classification entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data classification delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
