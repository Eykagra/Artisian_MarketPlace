const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com';
// Exact model id from NVIDIA NIM catalog (e.g. mistral-large-3-675b-instruct-2512)
const NIM_MODEL = process.env.NIM_MODEL || 'mistralai/mistral-large-3-675b-instruct-2512';
const NIM_API_KEY = process.env.NIM_API_KEY;

const SYSTEM_PROMPT =
  'You are an assistant helping local artisans list products on a marketplace. ' +
  'Have a short, friendly conversation to collect: product title, description, price in INR, category, and stock quantity (how many units are available). ' +
  'As soon as you have all five (title, description, price, category, stock), end your reply with a line that says EXACTLY ' +
  '`STRUCTURED_PRODUCT:` followed by a single JSON object with only these fields: title, description, price (number), category, stock (integer). ' +
  'Do not ask again for information the user has already provided. Do not repeat questions. ' +
  'If the user has given enough details across the conversation, output STRUCTURED_PRODUCT in your very next response.';

function buildMessages(userMessage, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  return messages;
}

function extractStructuredProduct(text) {
  const marker = 'STRUCTURED_PRODUCT:';
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const jsonPart = text.slice(idx + marker.length).trim();
  const match = jsonPart.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed;
  } catch {
    return null;
  }
}

async function sendToNim(userMessage, history = []) {
  if (!NIM_API_KEY) {
    throw new Error('NIM_API_KEY is not configured');
  }

  const url = `${NIM_API_BASE}/v1/chat/completions`;
  const body = {
    model: NIM_MODEL,
    messages: buildMessages(userMessage, history),
    max_tokens: 2048,
    temperature: 0.15,
    top_p: 1.0,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${NIM_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NIM request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const structured = extractStructuredProduct(content);

  return {
    raw: data,
    text: content,
    product: structured,
  };
}

module.exports = { sendToNim };

