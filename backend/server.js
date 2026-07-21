const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { validateRuntime } = require('./config/runtime');
validateRuntime();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Env-driven CORS (CORS_ORIGINS comma-separated; * by default in dev)
const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', (req, res, next) => req.path === '/health' ? next() : require('./middleware/auth')(req, res, next));
app.use('/api/data-catalog', require('./routes/dataCatalog'));
app.use('/api/data-classification', require('./routes/dataClassification'));
app.use('/api/data-quality', require('./routes/dataQuality'));
app.use('/api/data-lineage', require('./routes/dataLineage'));
app.use('/api/metadata', require('./routes/metadata'));
app.use('/api/data-policies', require('./routes/dataPolicies'));
app.use('/api/data-stewardship', require('./routes/dataStewardship'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/access-control', require('./routes/accessControl'));
app.use('/api/data-glossary', require('./routes/dataGlossary'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/data-assets', require('./routes/dataAssets'));
app.use('/api/webhooks', require('./routes/webhooks').router);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/custom-views', require('./routes/customViews')); // Governance Views: lineage graph, classification heatmap, audit PDF, policy rules
app.use('/api/data-contract-monitor', require('./routes/dataContractMonitor'));
app.use('/api/governance-cases', require('./middleware/auth'), require('./routes/governanceCases'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generated AI, gap, warehouse, marketplace, PII-stream, and provider routes are quarantined.

app.listen(PORT, () => {
  console.log(`Data Governance API running on port ${PORT}`);
});
