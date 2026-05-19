const fetch = require('node-fetch');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getModel() {
  return process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3001',
    'X-Title': 'AI Automate Data Governance',
  };
}

async function callOpenRouter(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return {
      success: false,
      error: 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.',
      content: null,
      model: getModel(),
      usage: null,
    };
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        model: getModel(),
        messages,
        max_tokens: options.maxTokens || 2048,
        temperature: options.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `OpenRouter ${response.status}: ${text}`, content: null, model: getModel(), usage: null };
    }

    const data = await response.json();
    return {
      success: true,
      error: null,
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || getModel(),
      usage: data.usage || null,
    };
  } catch (err) {
    return { success: false, error: err.message, content: null, model: getModel(), usage: null };
  }
}

/**
 * 3-strategy JSON parser:
 *  1) parse the raw response directly
 *  2) strip ```json fences and parse the inner block
 *  3) regex-extract the first {...} or [...] block and parse that
 * Returns { ok: true, data } or { ok: false, raw } as a fallback.
 */
function parseAIJson(content) {
  if (!content || typeof content !== 'string') {
    return { ok: false, raw: content };
  }

  // Strategy 1: try direct parse
  try {
    return { ok: true, data: JSON.parse(content) };
  } catch (_) { /* fall through */ }

  // Strategy 2: strip code fences
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return { ok: true, data: JSON.parse(fenceMatch[1].trim()) };
    } catch (_) { /* fall through */ }
  }

  // Strategy 3: regex-extract first object or array
  const blockMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (blockMatch && blockMatch[1]) {
    try {
      return { ok: true, data: JSON.parse(blockMatch[1]) };
    } catch (_) { /* fall through */ }
  }

  return { ok: false, raw: content };
}

module.exports = { callOpenRouter, parseAIJson, getModel };
