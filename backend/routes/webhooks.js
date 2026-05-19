const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');
const authMiddleware = require('../middleware/auth');

// Ensure webhooks table exists
async function ensureWebhooksTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      url TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]',
      secret VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

ensureWebhooksTable().catch((err) => console.error('Webhooks table init error:', err));

// Generate HMAC-SHA256 signature for webhook payload
function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

// Fire a webhook to a URL with signed payload
async function fireWebhook(webhook, payload) {
  const signature = signPayload(payload, webhook.secret);
  try {
    const fetch = require('node-fetch');
    await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': payload.event,
      },
      body: JSON.stringify(payload),
      timeout: 10000,
    });
  } catch (err) {
    console.error(`Webhook delivery failed to ${webhook.url}:`, err.message);
  }
}

// Fire webhooks for a specific event - exported for use by other routes
async function dispatchWebhookEvent(event, data, userId = null) {
  try {
    let query = `SELECT * FROM webhooks WHERE is_active = true AND events @> $1::jsonb`;
    const params = [JSON.stringify([event])];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    const result = await pool.query(query, params);
    for (const webhook of result.rows) {
      const payload = { event, data, fired_at: new Date().toISOString() };
      fireWebhook(webhook, payload);
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err.message);
  }
}

// POST /api/webhooks - register a webhook
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { url, events } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'url and events (array) are required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO webhooks (user_id, url, events, secret, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, user_id, url, events, is_active, created_at`,
      [req.user.id, url, JSON.stringify(events), secret]
    );

    res.status(201).json({
      ...result.rows[0],
      secret,
      note: 'Save the secret - it will not be shown again. Use it to verify X-Webhook-Signature header.',
    });
  } catch (err) {
    console.error('Register webhook error:', err);
    res.status(500).json({ error: 'Failed to register webhook', details: err.message });
  }
});

// GET /api/webhooks - list webhooks for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, url, events, is_active, created_at
       FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ error: 'Failed to fetch webhooks', details: err.message });
  }
});

// DELETE /api/webhooks/:id - remove a webhook
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Failed to delete webhook', details: err.message });
  }
});

module.exports = { router, dispatchWebhookEvent };
