const { query } = require('../db');

async function createMessage(userId, content) {
  const result = await query(
    'INSERT INTO "Chat" (userid, content) VALUES ($1, $2) RETURNING id, userid AS "userId", content, createdat AS "createdAt"',
    [userId || null, content]
  );
  return result.rows[0];
}

module.exports = { createMessage };
