const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const sharp = require('sharp');

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com';
const NIM_API_KEY = process.env.NIM_API_KEY;           // text / chat model key
const NIM_VISION_API_KEY = process.env.NIM_VISION_API_KEY || NIM_API_KEY; // vision model key (falls back to same key if not set)

const TEXT_MODERATION_MODEL = process.env.NIM_MODEL || 'mistralai/mistral-large-3-675b-instruct-2512';
const IMAGE_MODERATION_MODEL = 'google/gemma-3n-e4b-it';

const BANNED_CATEGORIES = [
  'adult/sexual/pornographic content',
  'violence or gore',
  'illegal drugs or drug paraphernalia',
  'weapons (firearms, knives intended for harm)',
  'hate speech or hate symbols',
  'counterfeit or pirated goods',
  'human trafficking or exploitation',
  'dangerous chemicals or explosives',
  'gambling products',
  'tobacco or alcohol (if targeting minors)',
];

const TEXT_MODERATION_PROMPT =
  'You are a strict content moderator for an artisan handmade-goods marketplace. ' +
  'Evaluate the product listing fields below for policy violations.\n' +
  'Reject if any field suggests: ' + BANNED_CATEGORIES.join(', ') + '.\n' +
  'A product is ALLOWED if it is a genuine handmade/artisan item sold legitimately.\n' +
  'Reply with ONLY raw JSON (no markdown, no explanation outside JSON):\n' +
  '{"allowed": true, "reason": ""}\n' +
  '  — or —\n' +
  '{"allowed": false, "reason": "brief explanation of the violation"}';

const IMAGE_MODERATION_PROMPT =
  'You are a strict content moderator for an artisan marketplace. ' +
  'Look at this product image. Reject if it contains: ' + BANNED_CATEGORIES.join(', ') + '. ' +
  'Reply with ONLY raw JSON (no markdown): ' +
  '{"allowed": true, "reason": ""} or {"allowed": false, "reason": "brief violation description"}';

async function nimPost(model, messages, maxTokens = 256) {
  const isVisionModel = model === IMAGE_MODERATION_MODEL;
  const apiKey = isVisionModel ? NIM_VISION_API_KEY : NIM_API_KEY;
  if (!apiKey) throw new Error(isVisionModel ? 'NIM_VISION_API_KEY is not configured' : 'NIM_API_KEY is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${NIM_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.05,
        top_p: 1.0,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`NIM moderation request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseModResult(raw) {
  // Strip markdown fences if model wrapped the JSON
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return { allowed: true, reason: '' }; // fail-open if unparseable
  try {
    const parsed = JSON.parse(match[0]);
    return {
      allowed: parsed.allowed !== false, // default allow on ambiguity
      reason: String(parsed.reason || ''),
    };
  } catch {
    return { allowed: true, reason: '' };
  }
}

/**
 * Moderate product text fields.
 * @param {{ title: string, description: string, category: string }} fields
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
async function moderateText({ title, description, category }) {
  const userContent =
    `Title: ${title}\nDescription: ${description}\nCategory: ${category}`;

  const messages = [
    { role: 'system', content: TEXT_MODERATION_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const raw = await nimPost(TEXT_MODERATION_MODEL, messages, 128);
    return parseModResult(raw);
  } catch (err) {
    console.error('Text moderation error (fail-open):', err.message);
    return { allowed: true, reason: '' }; // fail-open — don't block on service error
  }
}

/**
 * Moderate a product image using the Gemma vision model.
 * @param {Buffer} buffer - Raw image bytes
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
async function moderateImage(buffer, mimeType) {
  // Resize to max 384×384 JPEG at quality 60 — keeps well within the 32K token limit
  // (a 384×384 JPEG at q60 is ~20-40KB → ~27-54K base64 chars → ~7-14K tokens)
  const resized = await sharp(buffer)
    .resize(384, 384, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();

  const b64 = resized.toString('base64');
  const imgTag = `<img src="data:image/jpeg;base64,${b64}" />`;

  const messages = [
    {
      role: 'user',
      content: `${IMAGE_MODERATION_PROMPT}\n\n${imgTag}`,
    },
  ];

  try {
    const raw = await nimPost(IMAGE_MODERATION_MODEL, messages, 128);
    return parseModResult(raw);
  } catch (err) {
    console.error('Image moderation error (fail-open):', err.message);
    return { allowed: true, reason: '' }; // fail-open — don't block on service error
  }
}

module.exports = { moderateText, moderateImage };
