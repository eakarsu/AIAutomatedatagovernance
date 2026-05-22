const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { contracts: 34, schema_breaks: 5, owners_notified: 5, downstream_assets: 82 },
    contracts: [
      { asset: 'passenger_profile', producer: 'CRM', consumer: 'Loyalty', breach: 'nullable email changed', severity: 'high' },
      { asset: 'flight_operations', producer: 'Ops DB', consumer: 'Crew BI', breach: 'enum value added', severity: 'medium' },
      { asset: 'baggage_events', producer: 'Scanner Stream', consumer: 'Claims', breach: 'late delivery SLA', severity: 'medium' },
    ],
  });
});

router.post('/validate', (req, res) => {
  const { asset = 'asset', changes = [] } = req.body || {};
  res.json({ asset, changes, compatible: changes.length === 0, recommendation: changes.length ? 'notify consumers and version contract' : 'contract unchanged' });
});

module.exports = router;
