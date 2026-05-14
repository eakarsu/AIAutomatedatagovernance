// Apply pass 5 — backlog extensions for AIAutomatedatagovernance
//
// ENV VARS (consumed by NEEDS-CREDS endpoints; absence triggers 503):
//   SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD          (Snowflake)
//   REDSHIFT_HOST, REDSHIFT_USER, REDSHIFT_PASSWORD                (Amazon Redshift)
//   BIGQUERY_PROJECT_ID, BIGQUERY_KEY_FILE                         (Google BigQuery)
//   PII_STREAM_BROKER, PII_STREAM_TOPIC                            (Real-time PII streaming, e.g., Kafka/Kinesis)
//   OPENROUTER_API_KEY                                             (existing AI key)
//
// All endpoints use authMiddleware. Tables are created with CREATE TABLE IF NOT EXISTS.
// All env-gated endpoints return 503 with `missing: <ENV>` when unset.

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { pool } = require('../db');

// ── Lazy table creation (additive only) ────────────────────────────────────
async function ensureExtTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dw_integration_runs (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(40) NOT NULL,           -- snowflake | redshift | bigquery
      action VARCHAR(60) NOT NULL,             -- discover | profile | sync
      target VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'queued',
      details JSONB,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_profiles (
      id SERIAL PRIMARY KEY,
      asset_name VARCHAR(255) NOT NULL,
      column_name VARCHAR(255),
      profile JSONB NOT NULL,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quality_scorecards (
      id SERIAL PRIMARY KEY,
      asset_name VARCHAR(255) NOT NULL,
      completeness NUMERIC(5,2) DEFAULT 0,
      accuracy NUMERIC(5,2) DEFAULT 0,
      consistency NUMERIC(5,2) DEFAULT 0,
      timeliness NUMERIC(5,2) DEFAULT 0,
      validity NUMERIC(5,2) DEFAULT 0,
      uniqueness NUMERIC(5,2) DEFAULT 0,
      overall_score NUMERIC(5,2) DEFAULT 0,
      details JSONB,
      user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id SERIAL PRIMARY KEY,
      asset_name VARCHAR(255) NOT NULL,
      domain VARCHAR(80),
      description TEXT,
      access_level VARCHAR(40) DEFAULT 'request',  -- request | open | restricted
      tags JSONB,
      pricing JSONB,
      owner_user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_requests (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
      requester_user_id INTEGER,
      purpose TEXT,
      status VARCHAR(20) DEFAULT 'pending', -- pending | approved | denied
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pii_stream_events (
      id SERIAL PRIMARY KEY,
      source VARCHAR(120),
      payload JSONB,
      pii_detected BOOLEAN DEFAULT FALSE,
      pii_types JSONB,
      received_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureExtTables();

function missingEnv(...keys) {
  return keys.filter(k => !process.env[k]);
}

// ── 1) Snowflake integration (NEEDS-CREDS) ─────────────────────────────────
router.post('/snowflake/discover', authMiddleware, async (req, res) => {
  const missing = missingEnv('SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD');
  if (missing.length) {
    return res.status(503).json({ error: 'Snowflake not configured', missing: missing.join(',') });
  }
  // Stub: real impl would connect via snowflake-sdk; here we record an attempt.
  const { warehouse, database } = req.body || {};
  const result = await pool.query(
    `INSERT INTO dw_integration_runs (provider, action, target, status, details, user_id)
     VALUES ('snowflake','discover',$1,'completed',$2,$3) RETURNING id`,
    [`${database || ''}/${warehouse || ''}`, JSON.stringify({ note: 'stub run; install snowflake-sdk for real discovery' }), req.user.id]
  );
  res.json({ success: true, run_id: result.rows[0].id, provider: 'snowflake', tables_discovered: 0, note: 'connector stub; SDK install required for live discovery' });
});

// ── 2) Redshift integration (NEEDS-CREDS) ──────────────────────────────────
router.post('/redshift/discover', authMiddleware, async (req, res) => {
  const missing = missingEnv('REDSHIFT_HOST', 'REDSHIFT_USER', 'REDSHIFT_PASSWORD');
  if (missing.length) {
    return res.status(503).json({ error: 'Redshift not configured', missing: missing.join(',') });
  }
  const { database } = req.body || {};
  const result = await pool.query(
    `INSERT INTO dw_integration_runs (provider, action, target, status, details, user_id)
     VALUES ('redshift','discover',$1,'completed',$2,$3) RETURNING id`,
    [database || '', JSON.stringify({ note: 'stub run; pg-driver compatible but creds required' }), req.user.id]
  );
  res.json({ success: true, run_id: result.rows[0].id, provider: 'redshift', tables_discovered: 0 });
});

// ── 3) BigQuery integration (NEEDS-CREDS) ──────────────────────────────────
router.post('/bigquery/discover', authMiddleware, async (req, res) => {
  const missing = missingEnv('BIGQUERY_PROJECT_ID', 'BIGQUERY_KEY_FILE');
  if (missing.length) {
    return res.status(503).json({ error: 'BigQuery not configured', missing: missing.join(',') });
  }
  const { dataset } = req.body || {};
  const result = await pool.query(
    `INSERT INTO dw_integration_runs (provider, action, target, status, details, user_id)
     VALUES ('bigquery','discover',$1,'completed',$2,$3) RETURNING id`,
    [`${process.env.BIGQUERY_PROJECT_ID}/${dataset || ''}`, JSON.stringify({ note: 'stub run; install @google-cloud/bigquery for live discovery' }), req.user.id]
  );
  res.json({ success: true, run_id: result.rows[0].id, provider: 'bigquery', tables_discovered: 0 });
});

router.get('/dw/runs', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM dw_integration_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ success: true, runs: rows });
});

// ── 4) Automated data profiling (TOO-RISKY → in-memory profiler) ───────────
// PRODUCT-DECISION: Profile is computed from caller-supplied JSON `rows` array
// (no live DB scan). For numeric columns we report min/max/avg/null_count/distinct;
// for strings: top 5 frequent values + null_count + distinct.
router.post('/profile/run', authMiddleware, async (req, res) => {
  const { asset_name, rows } = req.body || {};
  if (!asset_name || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'asset_name and non-empty rows array required' });
  }
  const cols = {};
  for (const r of rows) {
    for (const k of Object.keys(r || {})) {
      if (!cols[k]) cols[k] = [];
      cols[k].push(r[k]);
    }
  }
  const profile = {};
  for (const [col, values] of Object.entries(cols)) {
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const numeric = nonNull.filter(v => typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v))).map(v => parseFloat(v));
    const isNumeric = numeric.length === nonNull.length && nonNull.length > 0;
    const distinct = new Set(nonNull).size;
    const summary = {
      total: values.length,
      null_count: values.length - nonNull.length,
      distinct_count: distinct,
      type_guess: isNumeric ? 'numeric' : 'string'
    };
    if (isNumeric) {
      summary.min = Math.min(...numeric);
      summary.max = Math.max(...numeric);
      summary.avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    } else {
      const counts = {};
      for (const v of nonNull) counts[v] = (counts[v] || 0) + 1;
      summary.top_values = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, c]) => ({ value: v, count: c }));
    }
    profile[col] = summary;
  }
  const ins = await pool.query(
    `INSERT INTO data_profiles (asset_name, column_name, profile, user_id) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [asset_name, null, JSON.stringify(profile), req.user.id]
  );
  res.json({ success: true, id: ins.rows[0].id, asset_name, profile });
});

router.get('/profile/list', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM data_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]
  );
  res.json({ success: true, profiles: rows });
});

// ── 5) Data quality scorecards (MECHANICAL) ────────────────────────────────
// PRODUCT-DECISION: scorecard accepts six dimensions on a 0-100 scale.
// overall_score = simple unweighted average. Caller can override `weights`.
router.post('/scorecard', authMiddleware, async (req, res) => {
  const { asset_name, completeness = 0, accuracy = 0, consistency = 0, timeliness = 0, validity = 0, uniqueness = 0, weights, details } = req.body || {};
  if (!asset_name) return res.status(400).json({ error: 'asset_name required' });
  const dims = { completeness, accuracy, consistency, timeliness, validity, uniqueness };
  let overall;
  if (weights && typeof weights === 'object') {
    let totalW = 0, weighted = 0;
    for (const [k, v] of Object.entries(dims)) {
      const w = Number(weights[k] || 0);
      totalW += w; weighted += w * Number(v);
    }
    overall = totalW > 0 ? weighted / totalW : (Object.values(dims).reduce((a,b)=>a+Number(b),0) / 6);
  } else {
    overall = Object.values(dims).reduce((a,b)=>a+Number(b),0) / 6;
  }
  const ins = await pool.query(
    `INSERT INTO quality_scorecards (asset_name, completeness, accuracy, consistency, timeliness, validity, uniqueness, overall_score, details, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
    [asset_name, completeness, accuracy, consistency, timeliness, validity, uniqueness, overall.toFixed(2), JSON.stringify(details || {}), req.user.id]
  );
  res.json({ success: true, id: ins.rows[0].id, asset_name, overall_score: Number(overall.toFixed(2)), dimensions: dims });
});

router.get('/scorecard', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM quality_scorecards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]
  );
  res.json({ success: true, scorecards: rows });
});

// ── 6) Data marketplace (NEEDS-PRODUCT-DECISION) ───────────────────────────
// PRODUCT-DECISION: Marketplace = listings table + access_request flow.
// access_level default = "request" (consumer must request, owner approves).
router.post('/marketplace/listing', authMiddleware, async (req, res) => {
  const { asset_name, domain, description, access_level = 'request', tags = [], pricing = {} } = req.body || {};
  if (!asset_name) return res.status(400).json({ error: 'asset_name required' });
  const ins = await pool.query(
    `INSERT INTO marketplace_listings (asset_name, domain, description, access_level, tags, pricing, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [asset_name, domain || null, description || null, access_level, JSON.stringify(tags), JSON.stringify(pricing), req.user.id]
  );
  res.json({ success: true, listing: ins.rows[0] });
});

router.get('/marketplace/listings', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM marketplace_listings ORDER BY created_at DESC LIMIT 200`);
  res.json({ success: true, listings: rows });
});

router.post('/marketplace/request', authMiddleware, async (req, res) => {
  const { listing_id, purpose } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: 'listing_id required' });
  const ins = await pool.query(
    `INSERT INTO marketplace_requests (listing_id, requester_user_id, purpose) VALUES ($1,$2,$3) RETURNING *`,
    [listing_id, req.user.id, purpose || null]
  );
  res.json({ success: true, request: ins.rows[0] });
});

// ── 7) Real-time PII streaming (NEEDS-CREDS) ───────────────────────────────
router.get('/pii-stream/status', authMiddleware, async (req, res) => {
  const missing = missingEnv('PII_STREAM_BROKER', 'PII_STREAM_TOPIC');
  if (missing.length) {
    return res.status(503).json({ error: 'PII stream not configured', missing: missing.join(',') });
  }
  res.json({
    success: true,
    broker: process.env.PII_STREAM_BROKER,
    topic: process.env.PII_STREAM_TOPIC,
    state: 'configured (consumer SDK not bundled in this build)'
  });
});

// PRODUCT-DECISION: regex-based detection of email / SSN / phone / credit-card
// patterns. Real impl would call existing /api/ai/discover-sensitive on each event.
router.post('/pii-stream/ingest', authMiddleware, async (req, res) => {
  const { source, payload } = req.body || {};
  const text = JSON.stringify(payload || {});
  const piiTypes = [];
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) piiTypes.push('email');
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) piiTypes.push('ssn');
  if (/\b(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/.test(text)) piiTypes.push('phone');
  if (/\b(?:\d{4}[\s-]?){3}\d{4}\b/.test(text)) piiTypes.push('credit_card');
  const ins = await pool.query(
    `INSERT INTO pii_stream_events (source, payload, pii_detected, pii_types) VALUES ($1,$2,$3,$4) RETURNING id, received_at`,
    [source || 'unknown', JSON.stringify(payload || {}), piiTypes.length > 0, JSON.stringify(piiTypes)]
  );
  res.json({ success: true, event_id: ins.rows[0].id, pii_detected: piiTypes.length > 0, pii_types: piiTypes });
});

router.get('/pii-stream/events', authMiddleware, async (req, res) => {
  const onlyPII = req.query.pii_only === 'true';
  const where = onlyPII ? 'WHERE pii_detected = TRUE' : '';
  const { rows } = await pool.query(`SELECT * FROM pii_stream_events ${where} ORDER BY received_at DESC LIMIT 100`);
  res.json({ success: true, events: rows });
});

module.exports = router;
