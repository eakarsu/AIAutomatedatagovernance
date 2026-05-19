const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
app.use('/api/ai', require('./routes/ai'));
app.use('/api/data-assets', require('./routes/dataAssets'));
app.use('/api/webhooks', require('./routes/webhooks').router);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/ext', require('./routes/extensions')); // Apply pass 5 backlog: DW integrations, profiling, scorecards, marketplace, PII stream
app.use('/api/custom-views', require('./routes/customViews')); // Governance Views: lineage graph, classification heatmap, audit PDF, policy rules

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Airline Data Governance API running on port ${PORT}`);
});

// BATCH_00_AUDIT_MOUNTS
app.use('/api/data-profiling', require('./routes/dataProfiling'));
app.use('/api/master-data-mgmt', require('./routes/masterDataMgmt'));
app.use('/api/data-marketplace', require('./routes/dataMarketplace'));
app.use('/api/pii-stream', require('./routes/piiStream'));
app.use('/api/warehouse-bridge', require('./routes/warehouseBridge'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-schema-evolution-recommendation-engine', require('./routes/gap_ai_schema_evolution_recommendation_engine'));
app.use('/api/gap-ai-master-data-matching-dedup', require('./routes/gap_ai_master_data_matching_dedup'));
app.use('/api/gap-ai-auto-tagging-new-assets', require('./routes/gap_ai_auto_tagging_new_assets'));
app.use('/api/gap-ai-cost-hot-data-tier', require('./routes/gap_ai_cost_hot_data_tier'));
app.use('/api/gap-live-data-warehouse-connector-snowflake', require('./routes/gap_live_data_warehouse_connector_snowflake'));
app.use('/api/gap-automated-data-profiling-at-ingestion', require('./routes/gap_automated_data_profiling_at_ingestion'));
app.use('/api/gap-data-quality-scorecards', require('./routes/gap_data_quality_scorecards'));
app.use('/api/gap-notifications-subsystem-beyond-webhooks', require('./routes/gap_notifications_subsystem_beyond_webhooks'));
app.use('/api/gap-data-product-marketplace-surface', require('./routes/gap_data_product_marketplace_surface'));
