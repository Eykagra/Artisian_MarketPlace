const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImage(req, res) {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(503).json({ error: 'Image upload not configured (Cloudinary env missing)' });
  }
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'artisan-marketplace' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      uploadStream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
}

module.exports = { uploadImage };
