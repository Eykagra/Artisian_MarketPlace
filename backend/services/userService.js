const { query } = require('../db');

async function ensureUserTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "User" (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdat TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function ensureRoleColumn() {
  await ensureUserTable();
  await query(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'buyer'
  `);
}

async function createUser(email, passwordHash, role = 'buyer') {
  await ensureRoleColumn();
  const result = await query(
    'INSERT INTO "User" (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, createdat AS "createdAt"',
    [email, passwordHash, role]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  await ensureRoleColumn();
  const result = await query(
    'SELECT id, email, password, role, createdat AS "createdAt" FROM "User" WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  await ensureRoleColumn();
  const result = await query(
    'SELECT id, email, role, createdat AS "createdAt" FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { createUser, findUserByEmail, findUserById };
