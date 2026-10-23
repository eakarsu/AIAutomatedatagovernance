'use strict';
const express = require('express');
const { runAiFeature } = require('../lib/featurePack26c');
const LABELS = {"total": "Governance cases", "byStatus": "Cases by status", "flagged": "Cases flagged for review", "emptyNote": "No governance cases supplied."};
const FEATURES = [["classification-gaps", "Classification gaps"], ["coverage-summary", "Lineage & policy coverage"], ["stewardship-triage", "Stewardship triage"]];
function createFeatureAiRouter({ authenticate, loadRecords } = {}) {
  const router = express.Router(); if (authenticate) router.use(authenticate);
  for (const [slug] of FEATURES) router.post('/' + slug, async (req, res) => { let records = Array.isArray(req.body?.records) ? req.body.records : null; if (!records && loadRecords) { try { records = await loadRecords(req); } catch { records = []; } } const out = await runAiFeature(slug, records || [], LABELS); return res.json({ feature: slug, ...out }); });
  router.get('/features', (req, res) => res.json({ features: FEATURES.map(([id, title]) => ({ id, title })) }));
  return router;
}
module.exports = { createFeatureAiRouter, FEATURES, LABELS };
