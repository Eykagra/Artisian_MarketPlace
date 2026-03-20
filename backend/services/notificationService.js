const { query } = require('../db');

async function ensureNotificationTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      id SERIAL PRIMARY KEY,
      userid INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function createNotification(userId, type, payload) {
  await ensureNotificationTable();
  const res = await query(
    `INSERT INTO "Notification" (userid, type, payload) VALUES ($1, $2, $3) RETURNING id`,
    [userId, type, JSON.stringify(payload)]
  );
  return res.rows[0].id;
}

async function getUnreadNotifications(userId) {
  await ensureNotificationTable();
  const res = await query(
    `SELECT id, type, payload, createdat FROM "Notification" 
     WHERE userid = $1 AND is_read = FALSE
     ORDER BY createdat ASC`,
    [userId]
  );
  return res.rows;
}

async function markAsRead(notificationId) {
  await query(
    `UPDATE "Notification" SET is_read = TRUE WHERE id = $1`,
    [notificationId]
  );
}

module.exports = {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  ensureNotificationTable
};
