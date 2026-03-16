const express = require('express');
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', optionalAuth, chatController.post);

module.exports = router;
