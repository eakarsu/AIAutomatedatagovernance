const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// GET / - list all, support ?search; paginated when ?page/?limit/?paginated=true is supplied (raw array otherwise for back-compat).
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const wantsPagination = req.query.page !== undefined || req.query.paginated === 'true' || req.query.limit !== undefined;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const params = [];
    let where = '';
    if (search) {
      params.push(search);
      params.push(`%${search}%`);
      where = `WHERE to_tsvector('english', table_name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)
               OR source_system ILIKE $2 OR owner ILIKE $2`;
    }

    if (!wantsPagination) {
      const all = await pool.query(`SELECT * FROM data_catalog ${where} ORDER BY created_at DESC`, params);
      return res.json(all.rows);
    }

    const cParams = [...params];
    params.push(limit); const lp = `$${params.length}`;
    params.push(offset); const op = `$${params.length}`;
    const result = await pool.query(
      `SELECT * FROM data_catalog ${where} ORDER BY created_at DESC LIMIT ${lp} OFFSET ${op}`,
      params
    );
    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM data_catalog ${where}`, cParams);

    res.json({
      data: result.rows,
      pagination: {
        page, limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (err) {
    console.error('Data catalog list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_catalog WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data catalog entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data catalog get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { table_name, schema_name, database_name, source_system, description, owner, row_count, column_count, status } = req.body;

    if (!table_name) {
      return res.status(400).json({ error: 'table_name is required' });
    }

    const result = await pool.query(
      `INSERT INTO data_catalog (table_name, schema_name, database_name, source_system, description, owner, row_count, column_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [table_name, schema_name || 'public', database_name || null, source_system || null, description || null, owner || null, row_count || 0, column_count || 0, status || 'active']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Data catalog create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { table_name, schema_name, database_name, source_system, description, owner, row_count, column_count, status } = req.body;

    const result = await pool.query(
      `UPDATE data_catalog SET table_name = COALESCE($1, table_name), schema_name = COALESCE($2, schema_name),
       database_name = COALESCE($3, database_name), source_system = COALESCE($4, source_system),
       description = COALESCE($5, description), owner = COALESCE($6, owner),
       row_count = COALESCE($7, row_count), column_count = COALESCE($8, column_count),
       status = COALESCE($9, status), updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [table_name, schema_name, database_name, source_system, description, owner, row_count, column_count, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data catalog entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Data catalog update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_catalog WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data catalog entry not found' });
    }
    res.json({ message: 'Data catalog entry deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Data catalog delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
