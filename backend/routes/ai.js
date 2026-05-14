const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const { pool } = require('../db');
const { callOpenRouter, parseAIJson, getModel } = require('../services/openrouter');

// 20 AI requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req, res)),
  message: { error: 'Too many AI requests. Limit is 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lazy table creation: ai_results JSONB persistence
async function ensureAIResultsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      endpoint VARCHAR(120) NOT NULL,
      input_data JSONB NOT NULL,
      result_data JSONB NOT NULL,
      user_id INTEGER,
      model_used VARCHAR(255),
      tokens_used INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_endpoint ON ai_results(endpoint)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results(user_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_created ON ai_results(created_at DESC)`).catch(() => {});
}
ensureAIResultsTable();

async function persist(endpoint, inputData, resultData, userId, model, usage) {
  try {
    await pool.query(
      `INSERT INTO ai_results (endpoint, input_data, result_data, user_id, model_used, tokens_used)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)`,
      [endpoint, JSON.stringify(inputData), JSON.stringify(resultData), userId || null, model || null, usage?.total_tokens || null]
    );
  } catch (err) {
    console.error('[ai_results] persist error:', err.message);
  }
}

// ── GET /api/ai/history — paginated list of past AI results ───────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const endpoint = req.query.endpoint || null;

    const where = endpoint ? 'WHERE endpoint = $1' : '';
    const params = endpoint ? [endpoint, limit, offset] : [limit, offset];
    const lp = endpoint ? '$2' : '$1';
    const op = endpoint ? '$3' : '$2';

    const { rows } = await pool.query(
      `SELECT id, endpoint, input_data, result_data, model_used, tokens_used, user_id, created_at
       FROM ai_results ${where}
       ORDER BY created_at DESC
       LIMIT ${lp} OFFSET ${op}`,
      params
    );

    const cParams = endpoint ? [endpoint] : [];
    const { rows: cRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ai_results ${endpoint ? 'WHERE endpoint = $1' : ''}`,
      cParams
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page, limit,
        total: cRows[0].total,
        totalPages: Math.ceil(cRows[0].total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /classify — Auto-classify a data column ─────────────────────────
router.post('/classify', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { table_name, column_name, sample_data, data_type } = req.body;
    if (!table_name || !column_name) return res.status(400).json({ error: 'table_name and column_name are required' });

    const messages = [
      { role: 'system', content: `You are an expert data governance officer. Classify data assets and identify PII, PHI, PCI, financial, or confidential classifications with justification.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "classification_level": "Public|Internal|Confidential|Restricted",
  "pii_flag": true|false,
  "phi_flag": true|false,
  "pci_flag": true|false,
  "confidence_score": 0.0-1.0,
  "reasoning": "explanation string",
  "recommendations": ["recommendation1", "recommendation2"]
}` },
      { role: 'user', content: `Classify the following column.

Table: ${table_name}
Column: ${column_name}
Data Type: ${data_type || 'unknown'}
Sample Data: ${JSON.stringify(sample_data || 'not provided')}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('classify', { table_name, column_name }, data, req.user?.id, r.model, r.usage);
    res.json({ table_name, column_name, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI classification failed', details: err.message });
  }
});

// ── POST /anomaly-detection ──────────────────────────────────────────────
router.post('/anomaly-detection', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { table_name, column_name, statistics, recent_values } = req.body;
    if (!table_name || !column_name) return res.status(400).json({ error: 'table_name and column_name are required' });

    const messages = [
      { role: 'system', content: `You are a data quality expert. Assess completeness, accuracy, consistency, timeliness, and validity of data on a 0-100 scale.
You must respond with valid JSON only. Use this exact structure:
{
  "anomalies_found": true|false,
  "anomalies": [{"type": "...","description": "...","severity": "low|medium|high|critical","affected_records": "..."}],
  "patterns_detected": ["pattern1"],
  "recommendations": ["recommendation1"],
  "overall_severity": "low|medium|high|critical"
}` },
      { role: 'user', content: `Analyze data anomalies for ${table_name}.${column_name}.

Statistics: ${JSON.stringify(statistics || 'not provided')}
Recent Values: ${JSON.stringify(recent_values || 'not provided')}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('anomaly-detection', { table_name, column_name }, data, req.user?.id, r.model, r.usage);
    res.json({ table_name, column_name, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI anomaly detection failed', details: err.message });
  }
});

// ── POST /generate-policy ────────────────────────────────────────────────
router.post('/generate-policy', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { policy_type, scope, industry_context, compliance_requirements } = req.body;
    if (!policy_type) return res.status(400).json({ error: 'policy_type is required' });

    const messages = [
      { role: 'system', content: `You are a data governance policy expert. Respond with valid JSON only:
{
  "policy_name": "...",
  "description": "...",
  "key_provisions": ["..."],
  "implementation_steps": ["..."],
  "review_schedule": "...",
  "enforcement_guidelines": "...",
  "exceptions_process": "..."
}` },
      { role: 'user', content: `Generate policy for: ${policy_type}
Scope: ${scope || 'organization-wide'}
Industry: ${industry_context || 'general'}
Compliance: ${JSON.stringify(compliance_requirements || ['GDPR', 'SOX'])}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('generate-policy', { policy_type, scope }, data, req.user?.id, r.model, r.usage);
    res.json({ policy_type, scope: scope || 'organization-wide', ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI policy generation failed', details: err.message });
  }
});

// ── POST /impact-analysis ────────────────────────────────────────────────
router.post('/impact-analysis', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { change_type, target_table, target_column, proposed_change } = req.body;
    if (!change_type || !target_table) return res.status(400).json({ error: 'change_type and target_table are required' });

    const messages = [
      { role: 'system', content: `You are a data lineage expert. Respond with valid JSON only:
{
  "risk_level": "low|medium|high|critical",
  "affected_systems": ["..."],
  "affected_tables": ["..."],
  "downstream_impacts": [{"system": "...","impact": "...","severity": "..."}],
  "recommendations": ["..."],
  "mitigation_steps": ["..."],
  "estimated_effort": "...",
  "rollback_plan": "..."
}` },
      { role: 'user', content: `Analyze impact:
Change: ${change_type}
Target: ${target_table}.${target_column || 'N/A'}
Proposed: ${JSON.stringify(proposed_change || 'not specified')}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('impact-analysis', { change_type, target_table, target_column }, data, req.user?.id, r.model, r.usage);
    res.json({ change_type, target_table, target_column: target_column || null, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI impact analysis failed', details: err.message });
  }
});

// ── POST /suggest-quality-rules ──────────────────────────────────────────
router.post('/suggest-quality-rules', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { table_name, columns, sample_data } = req.body;
    if (!table_name) return res.status(400).json({ error: 'table_name is required' });

    const messages = [
      { role: 'system', content: `You are a data quality rules expert. Respond with valid JSON only:
{
  "rules": [{"rule_name":"...","rule_type":"completeness|accuracy|consistency|timeliness|uniqueness|validity","rule_expression":"...","threshold":0-100,"rationale":"...","priority":"low|medium|high|critical"}],
  "summary": "..."
}` },
      { role: 'user', content: `Suggest quality rules for ${table_name}.
Columns: ${JSON.stringify(columns || 'not provided')}
Sample: ${JSON.stringify(sample_data || 'not provided')}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('suggest-quality-rules', { table_name }, data, req.user?.id, r.model, r.usage);
    res.json({ table_name, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI quality rule suggestion failed', details: err.message });
  }
});

// ── POST /generate-description ───────────────────────────────────────────
router.post('/generate-description', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { table_name, column_name, data_type, sample_values } = req.body;
    if (!table_name) return res.status(400).json({ error: 'table_name is required' });

    const messages = [
      { role: 'system', content: `You are a metadata management expert. Respond with valid JSON only:
{
  "description": "technical description",
  "business_definition": "business-friendly definition",
  "suggested_tags": ["tag1"],
  "data_domain": "domain classification",
  "usage_notes": "notes"
}` },
      { role: 'user', content: `Generate metadata for ${table_name}.${column_name || '(table)'}.
Data Type: ${data_type || 'unknown'}
Samples: ${JSON.stringify(sample_values || 'not provided')}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('generate-description', { table_name, column_name }, data, req.user?.id, r.model, r.usage);
    res.json({ table_name, column_name: column_name || null, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'AI description generation failed', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// NEW FEATURES (from audit)
// ─────────────────────────────────────────────────────────────────────────

// ── 1. Automated Data Discovery Scanner (regex-based + AI hint) ──────────
//      Scans a list of column samples for sensitive patterns.
const SENSITIVE_PATTERNS = [
  { name: 'SSN',          regex: /\b\d{3}-\d{2}-\d{4}\b/,                                       category: 'PII' },
  { name: 'Email',        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,         category: 'PII' },
  { name: 'Phone',        regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/, category: 'PII' },
  { name: 'Credit Card',  regex: /\b(?:\d[ -]*?){13,16}\b/,                                     category: 'PCI' },
  { name: 'IP Address',   regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,                                 category: 'Infrastructure' },
  { name: 'IBAN',         regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/,                             category: 'Financial' },
  { name: 'Date of Birth',regex: /\b(0[1-9]|1[0-2])[\/-](0[1-9]|[12]\d|3[01])[\/-](19|20)\d{2}\b/, category: 'PII' },
  { name: 'MRN',          regex: /\bMRN[-:#\s]?\d{6,}\b/i,                                      category: 'PHI' },
];
router.post('/discover-sensitive', authMiddleware, async (req, res) => {
  try {
    const { columns } = req.body; // [{ table, column, sample: "string" }]
    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'columns must be a non-empty array' });
    }

    const findings = columns.map((c) => {
      const sample = String(c.sample || '');
      const matched = SENSITIVE_PATTERNS
        .filter(p => p.regex.test(sample))
        .map(p => ({ pattern: p.name, category: p.category }));
      return {
        table: c.table || null,
        column: c.column || null,
        sensitive: matched.length > 0,
        matched_patterns: matched,
        recommended_classification: matched.some(m => m.category === 'PHI') ? 'Restricted'
          : matched.some(m => m.category === 'PCI') ? 'Restricted'
          : matched.some(m => m.category === 'PII') ? 'Confidential'
          : 'Internal',
      };
    });

    const summary = {
      total_columns: findings.length,
      sensitive_count: findings.filter(f => f.sensitive).length,
      pii_count: findings.filter(f => f.matched_patterns.some(m => m.category === 'PII')).length,
      phi_count: findings.filter(f => f.matched_patterns.some(m => m.category === 'PHI')).length,
      pci_count: findings.filter(f => f.matched_patterns.some(m => m.category === 'PCI')).length,
    };

    await persist('discover-sensitive', { count: columns.length }, { findings, summary }, req.user?.id, 'regex-scan', null);
    res.json({ success: true, findings, summary });
  } catch (err) {
    res.status(500).json({ error: 'Discovery scan failed', details: err.message });
  }
});

// ── 2. Privacy Impact Assessment (PIA) generator ─────────────────────────
router.post('/generate-pia', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { initiative_name, description, data_categories, processing_purpose, jurisdictions } = req.body;
    if (!initiative_name || !description) return res.status(400).json({ error: 'initiative_name and description are required' });

    const messages = [
      { role: 'system', content: `You are a privacy compliance expert specializing in GDPR/CCPA/HIPAA Privacy Impact Assessments. Respond with valid JSON only:
{
  "initiative_name": "...",
  "executive_summary": "...",
  "data_inventory": [{"category":"...","sensitivity":"...","legal_basis":"..."}],
  "risks": [{"risk":"...","likelihood":"low|medium|high","severity":"low|medium|high","mitigation":"..."}],
  "rights_impacts": ["impact on right to access, deletion, portability ..."],
  "controls_required": ["..."],
  "approval_required_from": ["DPO","Legal","Security"],
  "review_cycle_months": <integer>,
  "recommendation": "Approve|Approve with conditions|Reject"
}` },
      { role: 'user', content: `Generate a Privacy Impact Assessment.

Initiative: ${initiative_name}
Description: ${description}
Data Categories: ${JSON.stringify(data_categories || [])}
Processing Purpose: ${processing_purpose || 'not specified'}
Jurisdictions: ${JSON.stringify(jurisdictions || ['US','EU'])}` }
    ];

    const r = await callOpenRouter(messages, { maxTokens: 3000 });
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('generate-pia', { initiative_name, jurisdictions }, data, req.user?.id, r.model, r.usage);
    res.json({ ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'PIA generation failed', details: err.message });
  }
});

// ── 3. Data Retention Calculator ─────────────────────────────────────────
const RETENTION_RULES = {
  'GDPR':    { default_days: 365 * 6,  PII: 365 * 6,  Financial: 365 * 7,  PHI: 365 * 6 },
  'HIPAA':   { default_days: 365 * 6,  PII: 365 * 6,  Financial: 365 * 7,  PHI: 365 * 6 },
  'SOX':     { default_days: 365 * 7,  PII: 365 * 7,  Financial: 365 * 7,  PHI: 365 * 7 },
  'PCI-DSS': { default_days: 365 * 1,  PII: 365 * 1,  Financial: 365 * 1,  PHI: 365 * 1 },
  'CCPA':    { default_days: 365 * 2,  PII: 365 * 1,  Financial: 365 * 4,  PHI: 365 * 6 },
  'FERPA':   { default_days: 365 * 5,  PII: 365 * 5,  Financial: 365 * 5,  PHI: 365 * 5 },
};
router.post('/retention-recommendation', authMiddleware, async (req, res) => {
  try {
    const { data_category, frameworks, legal_hold } = req.body;
    if (!data_category) return res.status(400).json({ error: 'data_category is required (PII|Financial|PHI|Other)' });
    const fwks = (Array.isArray(frameworks) && frameworks.length > 0) ? frameworks : ['GDPR'];

    const recs = fwks.map(fw => {
      const rule = RETENTION_RULES[fw] || RETENTION_RULES.GDPR;
      return { framework: fw, recommended_days: rule[data_category] || rule.default_days };
    });
    // Use the longest retention as the binding requirement
    const binding = recs.reduce((max, r) => r.recommended_days > max.recommended_days ? r : max, recs[0]);
    const finalDays = legal_hold ? Math.max(binding.recommended_days, 365 * 10) : binding.recommended_days;

    const result = {
      data_category,
      frameworks_evaluated: fwks,
      per_framework: recs,
      binding_framework: binding.framework,
      recommended_retention_days: finalDays,
      recommended_retention_years: Math.round((finalDays / 365) * 10) / 10,
      legal_hold_applied: !!legal_hold,
      review_at: new Date(Date.now() + finalDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };

    await persist('retention-recommendation', { data_category, frameworks: fwks }, result, req.user?.id, 'rules-engine', null);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Retention calc failed', details: err.message });
  }
});

// ── 4. Lineage Visualization (graph builder) ─────────────────────────────
//      Returns nodes/edges for a data asset's upstream/downstream graph.
router.get('/lineage-graph/:tableName', authMiddleware, async (req, res) => {
  try {
    const { tableName } = req.params;
    const depth = Math.min(5, Math.max(1, parseInt(req.query.depth) || 2));

    // Pull lineage rows from data_lineage table — assumes schema columns:
    //   source_table, target_table, transformation_type
    let lineageRows = [];
    try {
      const { rows } = await pool.query(
        `SELECT source_table, target_table, transformation_type
         FROM data_lineage
         WHERE source_table ILIKE $1 OR target_table ILIKE $1`,
        [`%${tableName}%`]
      );
      lineageRows = rows;
    } catch (_) { /* table may not exist; return empty */ }

    const nodes = new Map();
    const edges = [];
    const addNode = (name, type) => {
      if (!nodes.has(name)) nodes.set(name, { id: name, label: name, type });
    };

    // Seed with the requested table
    addNode(tableName, 'focus');

    // Walk lineage to `depth` levels (BFS)
    let frontier = new Set([tableName]);
    for (let i = 0; i < depth; i++) {
      const next = new Set();
      for (const node of frontier) {
        for (const row of lineageRows) {
          if (row.source_table === node) {
            addNode(row.target_table, 'downstream');
            edges.push({ from: node, to: row.target_table, label: row.transformation_type || 'flow' });
            next.add(row.target_table);
          }
          if (row.target_table === node) {
            addNode(row.source_table, 'upstream');
            edges.push({ from: row.source_table, to: node, label: row.transformation_type || 'flow' });
            next.add(row.source_table);
          }
        }
      }
      frontier = next;
      if (frontier.size === 0) break;
    }

    res.json({
      success: true,
      focus_table: tableName,
      depth,
      nodes: Array.from(nodes.values()),
      edges,
    });
  } catch (err) {
    res.status(500).json({ error: 'Lineage graph build failed', details: err.message });
  }
});

// ── 5. Anomaly / Access-Pattern Detector ─────────────────────────────────
//      Heuristic detection of unusual access patterns.
router.post('/detect-access-anomalies', authMiddleware, async (req, res) => {
  try {
    const { access_logs } = req.body;
    if (!Array.isArray(access_logs)) return res.status(400).json({ error: 'access_logs must be an array' });

    // Simple heuristics: high request volume, off-hours access, distinct endpoints
    const userStats = {};
    for (const log of access_logs) {
      const u = log.user_id || log.user || 'unknown';
      const ts = new Date(log.timestamp || log.created_at || Date.now());
      const hour = ts.getHours();
      if (!userStats[u]) userStats[u] = { count: 0, off_hours: 0, distinct_resources: new Set() };
      userStats[u].count++;
      if (hour < 6 || hour > 22) userStats[u].off_hours++;
      if (log.resource) userStats[u].distinct_resources.add(log.resource);
    }

    const findings = Object.entries(userStats).map(([user, s]) => {
      const offHoursRatio = s.count > 0 ? s.off_hours / s.count : 0;
      const flags = [];
      if (s.count > 500) flags.push('HIGH_VOLUME');
      if (offHoursRatio > 0.3) flags.push('OFF_HOURS_HEAVY');
      if (s.distinct_resources.size > 50) flags.push('BROAD_ACCESS');
      return {
        user,
        access_count: s.count,
        off_hours_count: s.off_hours,
        distinct_resources: s.distinct_resources.size,
        risk_flags: flags,
        risk_score: flags.length * 33, // 0/33/66/99
      };
    }).sort((a, b) => b.risk_score - a.risk_score);

    await persist('detect-access-anomalies', { log_count: access_logs.length }, { findings }, req.user?.id, 'heuristic', null);
    res.json({ success: true, findings, total_users: findings.length });
  } catch (err) {
    res.status(500).json({ error: 'Anomaly detection failed', details: err.message });
  }
});

// ── 6. Glossary Term Suggester ───────────────────────────────────────────
router.post('/suggest-glossary', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { columns } = req.body; // [{ table_name, column_name, data_type }]
    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'columns must be a non-empty array' });
    }

    const messages = [
      { role: 'system', content: `You are a business glossary expert. Generate plain-English glossary entries for technical column names. Respond with valid JSON only:
{
  "terms": [{"column":"...","term":"...","definition":"...","aliases":["..."],"category":"..."}]
}` },
      { role: 'user', content: `Generate glossary entries for these columns:\n${columns.map(c => `- ${c.table_name || ''}.${c.column_name} (${c.data_type || 'unknown'})`).join('\n')}` }
    ];

    const r = await callOpenRouter(messages, { maxTokens: 2500 });
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('suggest-glossary', { count: columns.length }, data, req.user?.id, r.model, r.usage);
    res.json({ success: true, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'Glossary suggestion failed', details: err.message });
  }
});

// ── 7. Compliance Report Generator (SOC2/HIPAA/GDPR) ─────────────────────
router.post('/generate-compliance-report', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { framework, period_start, period_end, scope } = req.body;
    if (!framework) return res.status(400).json({ error: 'framework is required (SOC2|HIPAA|GDPR|SOX|PCI-DSS)' });

    // Pull aggregate counts from classification + compliance tables
    let summary = { classified_assets: 0, pii_count: 0, phi_count: 0, pci_count: 0, policies: 0 };
    try {
      const { rows: c1 } = await pool.query(
        `SELECT
            COUNT(*)::int AS classified_assets,
            COUNT(*) FILTER (WHERE pii_flag = true)::int AS pii_count,
            COUNT(*) FILTER (WHERE phi_flag = true)::int AS phi_count,
            COUNT(*) FILTER (WHERE pci_flag = true)::int AS pci_count
         FROM data_classification`
      );
      if (c1[0]) summary = { ...summary, ...c1[0] };
      const { rows: c2 } = await pool.query(`SELECT COUNT(*)::int AS policies FROM data_policies`).catch(() => ({ rows: [{ policies: 0 }] }));
      summary.policies = c2[0]?.policies || 0;
    } catch (_) { /* tables may differ; tolerate */ }

    const messages = [
      { role: 'system', content: `You are a compliance reporting expert. Generate a structured compliance report. Respond with valid JSON only:
{
  "framework": "...",
  "period": "...",
  "executive_summary": "...",
  "control_areas": [{"area":"...","status":"compliant|gap|non-compliant","evidence":"...","gaps":["..."]}],
  "metrics": {"classified_assets":0,"pii_handled":0,"controls_passed":0,"controls_failed":0},
  "remediation_priorities": ["..."],
  "next_review_date": "YYYY-MM-DD"
}` },
      { role: 'user', content: `Generate a ${framework} compliance report.
Period: ${period_start || 'YTD'} to ${period_end || 'today'}
Scope: ${scope || 'enterprise'}
Aggregate metrics from system: ${JSON.stringify(summary)}` }
    ];

    const r = await callOpenRouter(messages, { maxTokens: 3000 });
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('generate-compliance-report', { framework, period_start, period_end }, data, req.user?.id, r.model, r.usage);
    res.json({ success: true, system_metrics: summary, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'Compliance report generation failed', details: err.message });
  }
});

// ── 8. Steward Workload Balancer ─────────────────────────────────────────
//      Returns a recommended assignment of unassigned assets to stewards
//      by domain match + current workload (lowest-loaded gets first pick).
router.post('/balance-stewards', authMiddleware, async (req, res) => {
  try {
    const { unassigned_assets } = req.body; // [{ id, name, domain }]
    if (!Array.isArray(unassigned_assets)) return res.status(400).json({ error: 'unassigned_assets must be an array' });

    let stewards = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, full_name, department, COALESCE(active_assets, 0) AS workload
         FROM data_stewards`
      );
      stewards = rows.map(s => ({
        id: s.id,
        name: s.full_name,
        domain: (s.department || '').toLowerCase(),
        workload: parseInt(s.workload) || 0,
      }));
    } catch (_) {
      // Fallback fake list if table not available
      stewards = [{ id: 1, name: 'Default Steward', domain: 'general', workload: 0 }];
    }

    if (stewards.length === 0) {
      return res.status(409).json({ error: 'No stewards available for assignment.' });
    }

    const assignments = unassigned_assets.map(asset => {
      const domain = (asset.domain || '').toLowerCase();
      const candidates = stewards
        .map(s => ({ ...s, score: (s.domain && domain.includes(s.domain) ? 100 : 0) - s.workload }))
        .sort((a, b) => b.score - a.score);
      const winner = candidates[0];
      winner.workload += 1; // increment for next iteration
      return {
        asset_id: asset.id,
        asset_name: asset.name,
        domain: asset.domain || null,
        assigned_to: { id: winner.id, name: winner.name, domain: winner.domain },
        match_score: winner.score,
      };
    });

    await persist('balance-stewards', { count: unassigned_assets.length }, { assignments }, req.user?.id, 'optimization', null);
    res.json({ success: true, assignments, total_assigned: assignments.length, stewards_used: new Set(assignments.map(a => a.assigned_to.id)).size });
  } catch (err) {
    res.status(500).json({ error: 'Steward balancing failed', details: err.message });
  }
});

// ── POST /schema-evolution — recommend schema changes & migrations ────────
router.post('/schema-evolution', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { table_name, current_schema, proposed_changes, downstream_consumers, business_context } = req.body;
    if (!table_name || !current_schema) return res.status(400).json({ error: 'table_name and current_schema are required' });

    const messages = [
      { role: 'system', content: `You are a data architect specializing in schema evolution and backward compatibility. Analyze proposed schema changes and produce a safe migration plan.
Respond with valid JSON only:
{
  "recommendation": "approve|approve-with-conditions|reject",
  "compatibility": "backward|forward|breaking",
  "risk_level": "low|medium|high|critical",
  "downstream_impact": ["..."],
  "migration_steps": ["..."],
  "rollback_plan": ["..."],
  "deprecation_notes": "...",
  "additional_changes_recommended": ["..."]
}` },
      { role: 'user', content: `Analyze the proposed schema change.

Table: ${table_name}
Current Schema: ${JSON.stringify(current_schema)}
Proposed Changes: ${JSON.stringify(proposed_changes || [])}
Downstream Consumers: ${JSON.stringify(downstream_consumers || [])}
Business Context: ${business_context || 'not provided'}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('schema-evolution', { table_name }, data, req.user?.id, r.model, r.usage);
    res.json({ table_name, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'Schema evolution analysis failed', details: err.message });
  }
});

// ── POST /master-data-match — AI-driven entity dedup / matching ───────────
router.post('/master-data-match', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { entity_type, records, match_threshold } = req.body;
    if (!Array.isArray(records) || records.length < 2) {
      return res.status(400).json({ error: 'records must be an array of at least 2 items' });
    }
    const threshold = typeof match_threshold === 'number' ? match_threshold : 0.85;

    const messages = [
      { role: 'system', content: `You are a master data management (MDM) specialist. Identify likely duplicate / matching entities across the records list using fuzzy similarity on names, identifiers, and addresses. Use the supplied threshold (0-1) to decide matches.
Respond with valid JSON only:
{
  "match_groups": [
    {"group_id": 1, "record_ids": ["..."], "match_score": 0.0-1.0, "matched_attributes": ["..."], "rationale": "...", "suggested_golden_record": {} }
  ],
  "unique_records": ["..."],
  "summary": {"total_records": <int>, "matched": <int>, "groups": <int>, "threshold_used": <number>}
}` },
      { role: 'user', content: `Detect duplicate ${entity_type || 'entity'} records using threshold ${threshold}.

Records: ${JSON.stringify(records)}` }
    ];

    const r = await callOpenRouter(messages);
    if (!r.success) return res.status(502).json({ error: r.error });
    const parsed = parseAIJson(r.content);
    const data = parsed.ok ? parsed.data : { raw_response: r.content };

    await persist('master-data-match', { entity_type, count: records.length, threshold }, data, req.user?.id, r.model, r.usage);
    res.json({ entity_type: entity_type || null, ...data, _model: r.model });
  } catch (err) {
    res.status(500).json({ error: 'Master data matching failed', details: err.message });
  }
});

module.exports = router;
