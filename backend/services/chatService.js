const { query } = require('../db');

async function ensureChatTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "Chat" (
      id SERIAL PRIMARY KEY,
      userid INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      createdat TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function createMessage(userId, content) {
  await ensureChatTable();
  const result = await query(
    'INSERT INTO "Chat" (userid, content) VALUES ($1, $2) RETURNING id, userid AS "userId", content, createdat AS "createdAt"',
    [userId || null, content]
  );
  return result.rows[0];
}

module.exports = { createMessage };
