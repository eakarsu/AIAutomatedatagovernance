const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Airline Data Governance API running on port ${PORT}`);
});
