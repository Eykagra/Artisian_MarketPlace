const chatService = require('../services/chatService');
const { sendToNim } = require('../services/nimService');

async function post(req, res) {
  try {
    const { content, history } = req.body;
    const userId = req.user?.userId || null;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    const trimmed = content.trim();
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }))
      : [];

    // Log the user message
    const logged = await chatService.createMessage(userId, trimmed);

    let ai;
    try {
      ai = await sendToNim(trimmed, safeHistory);
    } catch (err) {
      console.error('NIM error:', err.message);
      return res.status(502).json({
        message: logged,
        error: 'AI service temporarily unavailable',
      });
    }

    res.status(201).json({
      message: logged,
      ai: {
        text: ai.text,
        product: ai.product,
      },
    });
  } catch (err) {
    console.error('Chat post error:', err);
    res.status(500).json({ error: 'Failed to handle chat message' });
  }
}

module.exports = { post };

