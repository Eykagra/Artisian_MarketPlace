const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Mistral } = require('@mistralai/mistralai');

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is not configured');
    _client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  }
  return _client;
}

/**
 * Transcribe an audio buffer using Mistral's Voxtral model.
 * @param {Buffer} buffer - Raw audio bytes
 * @param {string} mimeType - e.g. 'audio/webm', 'audio/mp4'
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(buffer, mimeType) {
  const client = getClient();

  const audioBlob = new Blob([buffer], { type: mimeType });

  const result = await client.audio.transcriptions.complete({
    model: 'voxtral-mini-latest',
    file: audioBlob,
  });

  const text = result.text ?? '';
  return text.trim();
}

module.exports = { transcribeAudio };
