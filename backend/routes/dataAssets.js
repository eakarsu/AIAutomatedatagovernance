const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// Helper: mask a single value by detected PII type
function maskValue(value) {
  const str = String(value);

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    const [local, domain] = str.split('@');
    return `${local[0]}***@***.${domain.split('.').pop()}`;
  }

  // SSN (XXX-XX-XXXX or XXXXXXXXX)
  if (/^\d{3}-\d{2}-\d{4}$/.test(str)) {
    return `***-**-${str.slice(-4)}`;
  }
  if (/^\d{9}$/.test(str)) {
    return `***-**-${str.slice(-4)}`;
  }

  // Phone (various formats)
  if (/^[\+]?[\d\s\-().]{7,15}$/.test(str) && str.replace(/\D/g, '').length >= 7) {
    const digits = str.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
  }

  // Credit card
  if (/^\d{13,19}$/.test(str)) {
    return `****-****-****-${str.slice(-4)}`;
  }

  // Generic: mask middle characters
  if (str.length <= 2) return '***';
  return `${str[0]}${'*'.repeat(Math.min(str.length - 2, 6))}${str[str.length - 1]}`;
}

function maskRecord(record, piiColumns) {
  const masked = { ...record };
  for (const col of piiColumns) {
    if (masked[col] !== undefined && masked[col] !== null) {
      masked[col] = maskValue(String(masked[col]));
    }
  }
  return masked;
}

// GET /api/data-assets/:id/preview-masked
// Returns a sample of data from data_catalog with PII columns masked.
// Uses data_classification to detect PII columns for the given table.
router.get('/:id/preview-masked', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the catalog entry
    const catalogResult = await pool.query('SELECT * FROM data_catalog WHERE id = $1', [id]);
    if (catalogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data asset not found' });
    }
    const asset = catalogResult.rows[0];

    // Get PII columns for this table
    const classResult = await pool.query(
      `SELECT column_name FROM data_classification
       WHERE table_name = $1 AND pii_flag = true`,
      [asset.table_name]
    );
    const piiColumns = classResult.rows.map((r) => r.column_name);

    // Build synthetic sample rows from metadata_repository for this table
    const metaResult = await pool.query(
      `SELECT column_name, data_type, description FROM metadata_repository
       WHERE table_name = $1 LIMIT 20`,
      [asset.table_name]
    );

    // Generate sample data rows with masking applied
    const sampleRows = Array.from({ length: 5 }, (_, rowIndex) => {
      const row = { _row: rowIndex + 1 };
      for (const col of metaResult.rows) {
        let sampleValue;
        const colName = col.column_name;
        const dt = (col.data_type || '').toLowerCase();

        if (piiColumns.includes(colName)) {
          // Generate a realistic-looking sample that will get masked
          if (colName.includes('email')) sampleValue = `user${rowIndex}@example.com`;
          else if (colName.includes('ssn') || colName.includes('social')) sampleValue = `${100 + rowIndex}-${10 + rowIndex}-${1000 + rowIndex}`;
          else if (colName.includes('phone')) sampleValue = `555-${100 + rowIndex}-${1000 + rowIndex}`;
          else if (colName.includes('card') || colName.includes('credit')) sampleValue = `4111111111111${111 + rowIndex}`;
          else sampleValue = `Sample_${colName}_${rowIndex}`;
        } else if (dt.includes('int') || dt.includes('serial')) {
          sampleValue = (rowIndex + 1) * 100;
        } else if (dt.includes('decimal') || dt.includes('float') || dt.includes('numeric')) {
          sampleValue = ((rowIndex + 1) * 99.99).toFixed(2);
        } else if (dt.includes('bool')) {
          sampleValue = rowIndex % 2 === 0;
        } else if (dt.includes('timestamp') || dt.includes('date')) {
          sampleValue = new Date(Date.now() - rowIndex * 86400000).toISOString().slice(0, 10);
        } else {
          sampleValue = `sample_${colName}_${rowIndex}`;
        }
        row[colName] = sampleValue;
      }
      return row;
    });

    // Apply masking
    const maskedRows = sampleRows.map((row) => maskRecord(row, piiColumns));

    res.json({
      asset_id: id,
      table_name: asset.table_name,
      pii_columns_masked: piiColumns,
      sample_count: maskedRows.length,
      note: 'Sample data is synthetic and generated from schema metadata. PII columns are masked.',
      rows: maskedRows,
    });
  } catch (err) {
    console.error('Preview masked error:', err);
    res.status(500).json({ error: 'Failed to generate masked preview', details: err.message });
  }
});

// GET /api/data-assets/:id/lineage-graph
// Returns a graph structure built from the data_lineage table
router.get('/:id/lineage-graph', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the catalog entry
    const catalogResult = await pool.query('SELECT * FROM data_catalog WHERE id = $1', [id]);
    if (catalogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data asset not found' });
    }
    const asset = catalogResult.rows[0];
    const tableName = asset.table_name;

    // Get all lineage entries where this table is source OR target
    const lineageResult = await pool.query(
      `SELECT * FROM data_lineage
       WHERE source_table = $1 OR target_table = $1
       ORDER BY created_at ASC`,
      [tableName]
    );

    const nodesMap = new Map();
    const edges = [];

    // Always include the root asset node
    nodesMap.set(`${asset.source_system || 'unknown'}:${tableName}`, {
      id: `${asset.source_system || 'unknown'}:${tableName}`,
      name: tableName,
      type: 'asset',
      system: asset.source_system || 'unknown',
    });

    for (const row of lineageResult.rows) {
      const srcKey = `${row.source_system}:${row.source_table}`;
      const tgtKey = `${row.target_system}:${row.target_table}`;

      if (!nodesMap.has(srcKey)) {
        nodesMap.set(srcKey, {
          id: srcKey,
          name: row.source_table,
          type: 'source',
          system: row.source_system,
        });
      }
      if (!nodesMap.has(tgtKey)) {
        nodesMap.set(tgtKey, {
          id: tgtKey,
          name: row.target_table,
          type: 'target',
          system: row.target_system,
        });
      }

      edges.push({
        from: srcKey,
        to: tgtKey,
        transformation: row.transformation_type || row.transformation_logic || 'direct',
        direction: row.data_flow_direction || 'upstream_to_downstream',
        lineage_id: row.id,
      });
    }

    res.json({
      asset_id: id,
      table_name: tableName,
      nodes: Array.from(nodesMap.values()),
      edges,
    });
  } catch (err) {
    console.error('Lineage graph error:', err);
    res.status(500).json({ error: 'Failed to build lineage graph', details: err.message });
  }
});

module.exports = router;
