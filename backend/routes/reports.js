const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getModel() {
  return process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
}

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// GET /api/reports/compliance - Generate compliance summary with AI executive summary
router.get('/compliance', authMiddleware, async (req, res) => {
  try {
    // 1. Assets by classification level
    const classificationResult = await pool.query(`
      SELECT classification_level, COUNT(*) AS asset_count
      FROM data_classification
      GROUP BY classification_level
      ORDER BY asset_count DESC
    `);

    // 2. PII assets with masking status (pii_flag = true, check if they are steward-assigned)
    const piiResult = await pool.query(`
      SELECT dc.table_name, dc.column_name, dc.classification_level,
             CASE WHEN ds.id IS NOT NULL THEN true ELSE false END AS has_steward
      FROM data_classification dc
      LEFT JOIN data_stewards ds ON ds.tables_managed @> ARRAY[dc.table_name]
      WHERE dc.pii_flag = true
      ORDER BY dc.classification_level DESC
    `);

    // 3. Assets without governance owners (data_catalog rows with no owner or no steward)
    const noOwnerResult = await pool.query(`
      SELECT cat.table_name, cat.source_system, cat.owner
      FROM data_catalog cat
      LEFT JOIN data_stewards ds ON ds.tables_managed @> ARRAY[cat.table_name]
      WHERE cat.owner IS NULL OR ds.id IS NULL
      ORDER BY cat.table_name
    `);

    // 4. Quality scores below 70
    const lowQualityResult = await pool.query(`
      SELECT rule_name, table_name, column_name, rule_type, current_score, threshold
      FROM data_quality_rules
      WHERE current_score IS NOT NULL AND current_score < 70
      ORDER BY current_score ASC
    `);

    const complianceSummary = {
      generated_at: new Date().toISOString(),
      assets_by_classification: classificationResult.rows,
      pii_assets: {
        total: piiResult.rows.length,
        with_steward: piiResult.rows.filter((r) => r.has_steward).length,
        without_steward: piiResult.rows.filter((r) => !r.has_steward).length,
        items: piiResult.rows,
      },
      assets_without_governance_owner: {
        total: noOwnerResult.rows.length,
        items: noOwnerResult.rows,
      },
      quality_scores_below_70: {
        total: lowQualityResult.rows.length,
        items: lowQualityResult.rows,
      },
    };

    // Generate AI executive summary
    let executiveSummary = null;
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const aiResponse = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            model: getModel(),
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert data governance officer. Write a concise 3-paragraph executive summary of the compliance status based on the provided metrics. Focus on risk areas, regulatory exposure, and recommended priorities. Be professional and action-oriented.',
              },
              {
                role: 'user',
                content: `Generate a 3-paragraph executive summary for the following compliance report data:\n\n${JSON.stringify(complianceSummary, null, 2)}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          executiveSummary = aiData.choices[0].message.content;
        }
      } catch (aiErr) {
        console.error('AI executive summary error:', aiErr.message);
        executiveSummary = 'AI summary unavailable.';
      }
    }

    res.json({
      ...complianceSummary,
      executive_summary: executiveSummary,
    });
  } catch (err) {
    console.error('Compliance report error:', err);
    res.status(500).json({ error: 'Failed to generate compliance report', details: err.message });
  }
});

module.exports = router;
