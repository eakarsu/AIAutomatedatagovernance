const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM access_control';
    const params = [];

    if (search) {
      query += ' WHERE resource_name ILIKE $1 OR resource_type ILIKE $1 OR role_name ILIKE $1 OR granted_by ILIKE $1 OR granted_to ILIKE $1 OR department ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Access control list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM access_control WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Access control entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Access control get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { resource_name, resource_type, role_name, permission_level, granted_by, granted_to, department, justification, expiry_date, status } = req.body;

    if (!resource_name || !resource_type || !permission_level) {
      return res.status(400).json({ error: 'resource_name, resource_type, and permission_level are required' });
    }

    const result = await pool.query(
      `INSERT INTO access_control (resource_name, resource_type, role_name, permission_level, granted_by, granted_to, department, justification, expiry_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [resource_name, resource_type, role_name || null, permission_level, granted_by || null, granted_to || null, department || null, justification || null, expiry_date || null, status || 'active']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Access control create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { resource_name, resource_type, role_name, permission_level, granted_by, granted_to, department, justification, expiry_date, status } = req.body;

    const result = await pool.query(
      `UPDATE access_control SET resource_name = COALESCE($1, resource_name), resource_type = COALESCE($2, resource_type),
       role_name = COALESCE($3, role_name), permission_level = COALESCE($4, permission_level),
       granted_by = COALESCE($5, granted_by), granted_to = COALESCE($6, granted_to),
       department = COALESCE($7, department), justification = COALESCE($8, justification),
       expiry_date = COALESCE($9, expiry_date), status = COALESCE($10, status)
       WHERE id = $11 RETURNING *`,
      [resource_name, resource_type, role_name, permission_level, granted_by, granted_to, department, justification, expiry_date, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Access control entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Access control update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM access_control WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Access control entry not found' });
    }
    res.json({ message: 'Access control entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Access control delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
