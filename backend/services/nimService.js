const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com';
// Exact model id from NVIDIA NIM catalog (e.g. mistral-large-3-675b-instruct-2512)
const NIM_MODEL = process.env.NIM_MODEL || 'mistralai/mistral-large-3-675b-instruct-2512';
const NIM_API_KEY = process.env.NIM_API_KEY;

const SYSTEM_PROMPT =
  'You are an assistant helping local artisans list products on a marketplace. ' +
  'Your ONLY job is to collect: title, short description, price in INR (number), category, and stock quantity (integer). ' +
  'Rules you MUST follow:\n' +
  '1. The VERY FIRST line of EVERY reply must be: SPEECH: <one short sentence in pure Hindi (Devanagari script), max 12 words, that captures the key point — e.g. "आपके उत्पाद की कीमत क्या है?" — suitable for Hindi TTS voice read-aloud>\n' +
  '2. The SPEECH line must ALWAYS be in pure Hindi using Devanagari script (no Roman/English words), regardless of what language the rest of the reply is in.\n' +
  '3. After the SPEECH line, write a blank line, then your full conversational reply.\n' +
  '3. Ask for ONLY the fields you still need — never repeat a question.\n' +
  '4. Do NOT ask "Is that correct?", "Shall I create?", "Confirm?" — just proceed.\n' +
  '5. Do NOT wait for the user to say "ok" or "yes" before outputting the listing.\n' +
  '6. The MOMENT you have all five fields, end your reply with EXACTLY:\n' +
  'STRUCTURED_PRODUCT: {"title":"...","description":"...","price":NUMBER,"category":"...","stock":INTEGER}\n' +
  '7. The JSON must be raw — no markdown, no code fences, no extra text after it.\n' +
  '8. If the user provides multiple fields at once, collect them all and output immediately.\n' +
  'Example of correct format:\n' +
  'SPEECH: आप इस उत्पाद को कितने रुपये में बेचना चाहते हैं?\n' +
  '\n' +
  'Great! What price (in INR) would you like to list this at?';

function buildMessages(userMessage, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  return messages;
}

/** Extract the SPEECH: line from the top of the model reply */
function extractSpeechLine(text) {
  const match = text.match(/^SPEECH:\s*(.+)/m);
  return match ? match[1].trim() : null;
}

function extractStructuredProduct(text) {
  const marker = 'STRUCTURED_PRODUCT:';
  const idx = text.indexOf(marker);
  if (idx !== -1) {
    const afterMarker = text.slice(idx + marker.length).trim();
    // Strip markdown code fences the model may have added
    const stripped = afterMarker
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through to heuristic
      }
    }
  }

  // Heuristic: model forgot the marker but emitted a JSON blob with all required fields
  const allJsonMatches = text.match(/\{[\s\S]*?\}/g) || [];
  for (const candidate of allJsonMatches) {
    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed.title != null &&
        parsed.description != null &&
        parsed.price != null &&
        parsed.category != null &&
        parsed.stock != null
      ) {
        return parsed;
      }
    } catch {
      // continue
    }
  }

  return null;
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
  const speech = extractSpeechLine(content);

  return {
    raw: data,
    text: content,
    product: structured,
    speech,
  };
}

module.exports = { sendToNim };

