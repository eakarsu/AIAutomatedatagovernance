const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM data_lineage';
    const params = [];

    if (search) {
      query += ' WHERE source_system ILIKE $1 OR source_table ILIKE $1 OR target_system ILIKE $1 OR target_table ILIKE $1 OR transformation_type ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Data lineage list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_lineage WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data lineage entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data lineage get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { source_system, source_table, target_system, target_table, transformation_type, transformation_logic, data_flow_direction, refresh_frequency, last_sync, status } = req.body;

    if (!source_system || !source_table || !target_system || !target_table) {
      return res.status(400).json({ error: 'source_system, source_table, target_system, and target_table are required' });
    }

    const result = await pool.query(
      `INSERT INTO data_lineage (source_system, source_table, target_system, target_table, transformation_type, transformation_logic, data_flow_direction, refresh_frequency, last_sync, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [source_system, source_table, target_system, target_table, transformation_type || null, transformation_logic || null, data_flow_direction || null, refresh_frequency || null, last_sync || null, status || 'active']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data lineage create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { source_system, source_table, target_system, target_table, transformation_type, transformation_logic, data_flow_direction, refresh_frequency, last_sync, status } = req.body;

    const result = await pool.query(
      `UPDATE data_lineage SET source_system = COALESCE($1, source_system), source_table = COALESCE($2, source_table),
       target_system = COALESCE($3, target_system), target_table = COALESCE($4, target_table),
       transformation_type = COALESCE($5, transformation_type), transformation_logic = COALESCE($6, transformation_logic),
       data_flow_direction = COALESCE($7, data_flow_direction), refresh_frequency = COALESCE($8, refresh_frequency),
       last_sync = COALESCE($9, last_sync), status = COALESCE($10, status)
       WHERE id = $11 RETURNING *`,
      [source_system, source_table, target_system, target_table, transformation_type, transformation_logic, data_flow_direction, refresh_frequency, last_sync, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data lineage entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data lineage update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_lineage WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data lineage entry not found' });
    }
    res.json({ message: 'Data lineage entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data lineage delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
