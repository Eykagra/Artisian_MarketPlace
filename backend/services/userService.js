const { query } = require('../db');

async function createUser(email, passwordHash) {
  const result = await query(
    'INSERT INTO "User" (email, password) VALUES ($1, $2) RETURNING id, email, createdat AS "createdAt"',
    [email, passwordHash]
  );
  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await query(
    'SELECT id, email, password, createdat AS "createdAt" FROM "User" WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(
    'SELECT id, email, createdat AS "createdAt" FROM "User" WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { createUser, findUserByEmail, findUserById };
