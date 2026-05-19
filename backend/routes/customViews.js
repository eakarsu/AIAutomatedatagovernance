/**
 * Custom Views API — Automated Data Governance
 *
 * Provides 4 synthesized endpoints powering the "Governance Views" surface:
 *  1) VIZ  GET /api/custom-views/lineage-graph        — data lineage graph (nodes/edges)
 *  2) VIZ  GET /api/custom-views/classification-heatmap — domain x sensitivity heatmap matrix
 *  3) NON  GET /api/custom-views/audit-pdf            — printable governance audit document
 *  4) NON  GET/PUT /api/custom-views/policy-rules     — editable policy rules registry
 *
 * Data is synthesized in-memory (no schema changes required) and seeded from
 * deterministic dictionaries so screenshots remain stable across runs.
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// ─── In-memory policy rules store (survives process lifetime) ───────────────
const DEFAULT_RULES = [
  {
    id: 'PR-001',
    name: 'PII Masking on Reservations',
    domain: 'Reservations',
    severity: 'High',
    action: 'mask',
    target: 'passenger.email,passenger.phone',
    enabled: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'PR-002',
    name: 'GDPR Retention 730 Days',
    domain: 'Customer',
    severity: 'High',
    action: 'expire',
    target: 'customer.profile.*',
    enabled: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'PR-003',
    name: 'Crew Roster Access — Steward Only',
    domain: 'Operations',
    severity: 'Medium',
    action: 'restrict',
    target: 'crew.roster',
    enabled: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'PR-004',
    name: 'Loyalty Tier — Sensitive Tagging',
    domain: 'Loyalty',
    severity: 'Medium',
    action: 'classify:sensitive',
    target: 'loyalty.tier,loyalty.balance',
    enabled: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'PR-005',
    name: 'Maintenance Logs — Audit Required',
    domain: 'Maintenance',
    severity: 'Low',
    action: 'audit',
    target: 'maintenance.log.*',
    enabled: false,
    updated_at: new Date().toISOString(),
  },
];

let RULES = JSON.parse(JSON.stringify(DEFAULT_RULES));

// ─── Synthesizers ───────────────────────────────────────────────────────────
function synthLineage() {
  const nodes = [
    { id: 'src_booking',  label: 'Booking System',    type: 'source',   x: 60,  y: 60,  domain: 'Reservations' },
    { id: 'src_crm',      label: 'CRM Cloud',         type: 'source',   x: 60,  y: 180, domain: 'Customer' },
    { id: 'src_ops',      label: 'Ops Telemetry',     type: 'source',   x: 60,  y: 300, domain: 'Operations' },
    { id: 'stg_landing',  label: 'Raw Landing Zone',  type: 'staging',  x: 260, y: 120, domain: 'Lake' },
    { id: 'stg_curated',  label: 'Curated Lake',      type: 'staging',  x: 260, y: 260, domain: 'Lake' },
    { id: 'mart_revenue', label: 'Revenue Mart',      type: 'mart',     x: 480, y: 90,  domain: 'Finance' },
    { id: 'mart_loyalty', label: 'Loyalty Mart',      type: 'mart',     x: 480, y: 220, domain: 'Loyalty' },
    { id: 'mart_ops',     label: 'Ops Mart',          type: 'mart',     x: 480, y: 340, domain: 'Operations' },
    { id: 'dash_exec',    label: 'Executive Dash',    type: 'consumer', x: 700, y: 130, domain: 'BI' },
    { id: 'dash_ops',     label: 'Ops Dashboard',     type: 'consumer', x: 700, y: 300, domain: 'BI' },
  ];
  const edges = [
    { from: 'src_booking', to: 'stg_landing',  label: 'ingest', quality: 0.96 },
    { from: 'src_crm',     to: 'stg_landing',  label: 'ingest', quality: 0.93 },
    { from: 'src_ops',     to: 'stg_curated',  label: 'stream', quality: 0.88 },
    { from: 'stg_landing', to: 'stg_curated',  label: 'cleanse',quality: 0.97 },
    { from: 'stg_curated', to: 'mart_revenue', label: 'model',  quality: 0.95 },
    { from: 'stg_curated', to: 'mart_loyalty', label: 'model',  quality: 0.92 },
    { from: 'stg_curated', to: 'mart_ops',     label: 'model',  quality: 0.90 },
    { from: 'mart_revenue',to: 'dash_exec',    label: 'report', quality: 0.99 },
    { from: 'mart_loyalty',to: 'dash_exec',    label: 'report', quality: 0.98 },
    { from: 'mart_ops',    to: 'dash_ops',     label: 'report', quality: 0.97 },
  ];
  return {
    nodes,
    edges,
    summary: {
      assets: nodes.length,
      pipelines: edges.length,
      sources: nodes.filter(n => n.type === 'source').length,
      marts: nodes.filter(n => n.type === 'mart').length,
      avg_quality: +(edges.reduce((a, e) => a + e.quality, 0) / edges.length).toFixed(3),
    },
  };
}

function synthHeatmap() {
  const domains = ['Reservations', 'Loyalty', 'Operations', 'Maintenance', 'Finance', 'Customer'];
  const levels  = ['Public', 'Internal', 'Confidential', 'Restricted', 'PII'];
  // Deterministic pseudo-random distribution
  const seed = (i, j) => Math.abs(Math.sin((i + 1) * 31 + (j + 1) * 17)) ;
  const matrix = domains.map((d, i) => ({
    domain: d,
    cells: levels.map((l, j) => ({
      level: l,
      count: Math.round(seed(i, j) * 80 + (l === 'PII' ? 10 : 5)),
    })),
  }));
  const max = matrix.reduce((m, row) => Math.max(m, ...row.cells.map(c => c.count)), 0);
  return {
    domains,
    levels,
    matrix,
    max,
    totals: {
      assets: matrix.reduce((s, r) => s + r.cells.reduce((a, c) => a + c.count, 0), 0),
      pii_assets: matrix.reduce((s, r) => s + (r.cells.find(c => c.level === 'PII')?.count || 0), 0),
    },
  };
}

function buildAuditPdf(req) {
  // Minimal but valid single-page PDF, content rendered as text streams.
  const now = new Date().toISOString();
  const user = req.user?.email || 'admin@skylineairways.com';
  const lines = [
    'SkyGov — Automated Data Governance Audit',
    `Generated: ${now}`,
    `Requested by: ${user}`,
    '',
    'Section 1: Scope',
    '  - Domains: Reservations, Loyalty, Operations, Maintenance, Finance, Customer',
    '  - Period: trailing 30 days',
    '',
    'Section 2: Key Findings',
    '  1. 312 assets classified; 78 contain PII.',
    '  2. 10 lineage pipelines operating at 94.3% average quality.',
    '  3. 4 active policy rules; 1 disabled (PR-005 Maintenance Logs).',
    '  4. 0 critical access violations in the audit window.',
    '',
    'Section 3: Recommendations',
    '  - Re-enable PR-005 to satisfy SOX maintenance audit coverage.',
    '  - Promote Loyalty Tier fields to Restricted classification.',
    '  - Add lineage probe between Ops Telemetry and Revenue Mart.',
    '',
    'Signed: SkyGov Governance Office',
  ];

  // Escape parens for PDF text strings
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const leading = 16;
  const startY = 780;
  let stream = 'BT\n/F1 12 Tf\n';
  lines.forEach((line, i) => {
    stream += `1 0 0 1 50 ${startY - i * leading} Tm (${esc(line)}) Tj\n`;
  });
  stream += 'ET';

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach(o => {
    offsets.push(pdf.length);
    pdf += o;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

// ─── Endpoint 1: Lineage Graph (VIZ) ────────────────────────────────────────
router.get('/lineage-graph', authMiddleware, (req, res) => {
  res.json({ success: true, data: synthLineage(), generated_at: new Date().toISOString() });
});

// ─── Endpoint 2: Classification Heatmap (VIZ) ───────────────────────────────
router.get('/classification-heatmap', authMiddleware, (req, res) => {
  res.json({ success: true, data: synthHeatmap(), generated_at: new Date().toISOString() });
});

// ─── Endpoint 3: Governance Audit PDF (NON-VIZ) ─────────────────────────────
router.get('/audit-pdf', authMiddleware, (req, res) => {
  const pdf = buildAuditPdf(req);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="skygov-audit.pdf"');
  res.setHeader('Content-Length', pdf.length);
  res.end(pdf);
});

// ─── Endpoint 4: Policy Rules Editor (NON-VIZ) ──────────────────────────────
router.get('/policy-rules', authMiddleware, (req, res) => {
  res.json({ success: true, data: RULES, count: RULES.length });
});

router.put('/policy-rules', authMiddleware, (req, res) => {
  const incoming = Array.isArray(req.body?.rules) ? req.body.rules : null;
  if (!incoming) {
    return res.status(400).json({ success: false, error: 'Body must include { rules: [...] }' });
  }
  RULES = incoming.map(r => ({
    id: r.id || `PR-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: r.name || 'Untitled Rule',
    domain: r.domain || 'General',
    severity: r.severity || 'Medium',
    action: r.action || 'audit',
    target: r.target || '*',
    enabled: r.enabled !== false,
    updated_at: new Date().toISOString(),
  }));
  res.json({ success: true, data: RULES, count: RULES.length });
});

module.exports = router;
