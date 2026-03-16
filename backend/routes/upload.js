const express = require('express');
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'));
  },
});

router.post('/image', requireAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image too large (max 5MB)' });
      return res.status(400).json({ error: err.message || 'Invalid file' });
    }
    uploadController.uploadImage(req, res).catch(next);
  });
});

module.exports = router;
