const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const authMiddleware = require('../middleware/auth');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function getModel() {
  return process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
}

async function callOpenRouter(messages) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: getModel(),
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return content;
}

function parseAIResponse(content) {
  // Try to extract JSON from the response, handling markdown code blocks
  let jsonStr = content;

  // Remove markdown code block wrappers if present
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // If direct parse fails, try to find JSON object or array in the string
    const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) {
        // Return raw content as fallback
        return { raw_response: content };
      }
    }
    return { raw_response: content };
  }
}

// POST /classify - Auto-classify a data column
router.post('/classify', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, sample_data, data_type } = req.body;

    if (!table_name || !column_name) {
      return res.status(400).json({ error: 'table_name and column_name are required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a data governance expert specializing in data classification for the airline industry.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "classification_level": "Public|Internal|Confidential|Restricted",
  "pii_flag": true|false,
  "phi_flag": true|false,
  "pci_flag": true|false,
  "confidence_score": 0.0-1.0,
  "reasoning": "explanation string",
  "recommendations": ["recommendation1", "recommendation2"]
}`
      },
      {
        role: 'user',
        content: `Classify the following data column for sensitivity level and regulatory flags.

Table: ${table_name}
Column: ${column_name}
Data Type: ${data_type || 'unknown'}
Sample Data: ${JSON.stringify(sample_data || 'not provided')}

Determine:
1. Classification level (Public, Internal, Confidential, or Restricted)
2. Whether this column contains PII (Personally Identifiable Information)
3. Whether this column contains PHI (Protected Health Information)
4. Whether this column contains PCI (Payment Card Industry) data
5. Confidence score (0.0 to 1.0)
6. Reasoning for the classification
7. Recommendations for handling this data`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      table_name,
      column_name,
      ...result,
    });
  } catch (err) {
    console.error('AI classify error:', err);
    res.status(500).json({ error: 'AI classification failed', details: err.message });
  }
});

// POST /anomaly-detection - Detect data quality anomalies
router.post('/anomaly-detection', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, statistics, recent_values } = req.body;

    if (!table_name || !column_name) {
      return res.status(400).json({ error: 'table_name and column_name are required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a data quality analyst specializing in anomaly detection for airline data systems.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "anomalies_found": true|false,
  "anomalies": [
    {
      "type": "anomaly type",
      "description": "description",
      "severity": "low|medium|high|critical",
      "affected_records": "estimate or description"
    }
  ],
  "patterns_detected": ["pattern1", "pattern2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "overall_severity": "low|medium|high|critical"
}`
      },
      {
        role: 'user',
        content: `Analyze the following data for anomalies, unusual patterns, and outliers.

Table: ${table_name}
Column: ${column_name}
Statistics: ${JSON.stringify(statistics || 'not provided')}
Recent Values: ${JSON.stringify(recent_values || 'not provided')}

Identify:
1. Any anomalies or outliers in the data
2. Unusual patterns or trends
3. Data quality concerns
4. Severity of each finding
5. Recommendations for resolution`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      table_name,
      column_name,
      ...result,
    });
  } catch (err) {
    console.error('AI anomaly detection error:', err);
    res.status(500).json({ error: 'AI anomaly detection failed', details: err.message });
  }
});

// POST /generate-policy - Generate governance policy
router.post('/generate-policy', authMiddleware, async (req, res) => {
  try {
    const { policy_type, scope, industry_context, compliance_requirements } = req.body;

    if (!policy_type) {
      return res.status(400).json({ error: 'policy_type is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a data governance policy expert for the airline industry.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "policy_name": "policy name string",
  "description": "comprehensive description",
  "key_provisions": ["provision1", "provision2"],
  "implementation_steps": ["step1", "step2"],
  "review_schedule": "review frequency and process",
  "enforcement_guidelines": "enforcement description",
  "exceptions_process": "exceptions description"
}`
      },
      {
        role: 'user',
        content: `Generate a comprehensive data governance policy for the following context.

Policy Type: ${policy_type}
Scope: ${scope || 'organization-wide'}
Industry Context: ${industry_context || 'airline / aviation'}
Compliance Requirements: ${JSON.stringify(compliance_requirements || ['GDPR', 'SOX'])}

Generate a complete policy including:
1. Policy name and description
2. Key provisions
3. Implementation steps
4. Review schedule
5. Enforcement guidelines
6. Exceptions process`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      policy_type,
      scope: scope || 'organization-wide',
      ...result,
    });
  } catch (err) {
    console.error('AI generate policy error:', err);
    res.status(500).json({ error: 'AI policy generation failed', details: err.message });
  }
});

// POST /impact-analysis - Analyze impact of data changes
router.post('/impact-analysis', authMiddleware, async (req, res) => {
  try {
    const { change_type, target_table, target_column, proposed_change } = req.body;

    if (!change_type || !target_table) {
      return res.status(400).json({ error: 'change_type and target_table are required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a data impact analysis expert for airline data systems.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "risk_level": "low|medium|high|critical",
  "affected_systems": ["system1", "system2"],
  "affected_tables": ["table1", "table2"],
  "downstream_impacts": [
    {
      "system": "system name",
      "impact": "description of impact",
      "severity": "low|medium|high|critical"
    }
  ],
  "recommendations": ["recommendation1", "recommendation2"],
  "mitigation_steps": ["step1", "step2"],
  "estimated_effort": "effort description",
  "rollback_plan": "rollback description"
}`
      },
      {
        role: 'user',
        content: `Analyze the downstream impact of the following proposed data change in an airline data system.

Change Type: ${change_type}
Target Table: ${target_table}
Target Column: ${target_column || 'N/A'}
Proposed Change: ${JSON.stringify(proposed_change || 'not specified')}

Analyze:
1. Overall risk level
2. Affected downstream systems (consider airline systems: reservations, flight ops, crew management, revenue, loyalty, maintenance, cargo)
3. Affected tables and data flows
4. Specific downstream impacts
5. Recommendations and mitigation steps
6. Estimated effort and rollback plan`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      change_type,
      target_table,
      target_column: target_column || null,
      ...result,
    });
  } catch (err) {
    console.error('AI impact analysis error:', err);
    res.status(500).json({ error: 'AI impact analysis failed', details: err.message });
  }
});

// POST /suggest-quality-rules - Suggest quality rules for a table
router.post('/suggest-quality-rules', authMiddleware, async (req, res) => {
  try {
    const { table_name, columns, sample_data } = req.body;

    if (!table_name) {
      return res.status(400).json({ error: 'table_name is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a data quality rules expert for airline data systems.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "rules": [
    {
      "rule_name": "rule name",
      "rule_type": "completeness|accuracy|consistency|timeliness|uniqueness|validity",
      "rule_expression": "SQL or logical expression",
      "threshold": 0.0-100.0,
      "rationale": "why this rule is important",
      "priority": "low|medium|high|critical"
    }
  ],
  "summary": "overall summary of suggested rules"
}`
      },
      {
        role: 'user',
        content: `Suggest comprehensive data quality rules for the following airline data table.

Table: ${table_name}
Columns: ${JSON.stringify(columns || 'not provided')}
Sample Data: ${JSON.stringify(sample_data || 'not provided')}

Suggest rules covering:
1. Completeness checks (null/missing values)
2. Accuracy validation
3. Consistency across related fields
4. Timeliness requirements
5. Uniqueness constraints
6. Format and validity checks

For each rule, provide name, type, expression, threshold, rationale, and priority.`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      table_name,
      ...result,
    });
  } catch (err) {
    console.error('AI suggest quality rules error:', err);
    res.status(500).json({ error: 'AI quality rule suggestion failed', details: err.message });
  }
});

// POST /generate-description - Generate metadata descriptions
router.post('/generate-description', authMiddleware, async (req, res) => {
  try {
    const { table_name, column_name, data_type, sample_values } = req.body;

    if (!table_name) {
      return res.status(400).json({ error: 'table_name is required' });
    }

    const messages = [
      {
        role: 'system',
        content: `You are a metadata management expert for airline data systems.
You must respond with valid JSON only, no additional text. Use this exact structure:
{
  "description": "technical description",
  "business_definition": "business-friendly definition",
  "suggested_tags": ["tag1", "tag2"],
  "data_domain": "domain classification",
  "usage_notes": "notes about how this data is typically used"
}`
      },
      {
        role: 'user',
        content: `Generate business-friendly metadata descriptions for the following airline data element.

Table: ${table_name}
Column: ${column_name || 'N/A (table-level description)'}
Data Type: ${data_type || 'unknown'}
Sample Values: ${JSON.stringify(sample_values || 'not provided')}

Generate:
1. A concise technical description
2. A business-friendly definition that non-technical stakeholders can understand
3. Suggested tags for categorization
4. Data domain classification
5. Usage notes`
      }
    ];

    const content = await callOpenRouter(messages);
    const result = parseAIResponse(content);

    res.json({
      table_name,
      column_name: column_name || null,
      ...result,
    });
  } catch (err) {
    console.error('AI generate description error:', err);
    res.status(500).json({ error: 'AI description generation failed', details: err.message });
  }
});

module.exports = router;
