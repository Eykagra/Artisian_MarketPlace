const express = require('express');
const multer = require('multer');
const { transcribeAudio } = require('../services/transcriptionService');

const router = express.Router();

// Keep audio in memory — no disk writes needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true);
    cb(new Error('Only audio files are accepted'));
  },
});

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

  try {
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
    if (!text) return res.status(422).json({ error: 'Could not transcribe audio — please try again' });
    res.json({ text });
  } catch (err) {
    console.error('Transcription error:', err.message);
    const status = err.message.includes('MISTRAL_API_KEY') ? 503 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
