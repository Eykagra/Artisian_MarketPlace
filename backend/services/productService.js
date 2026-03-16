const { query } = require('../db');

async function getAll() {
  const result = await query(
    'SELECT p.id, p.title, p.description, p.price, p.category, p.imageurl AS "imageUrl", p.sellerid AS "sellerId", p.createdat AS "createdAt", u.email AS "sellerEmail" FROM "Product" p LEFT JOIN "User" u ON p.sellerid = u.id ORDER BY p.createdat DESC'
  );
  return result.rows;
}

async function getById(id) {
  const result = await query(
    'SELECT p.id, p.title, p.description, p.price, p.category, p.imageurl AS "imageUrl", p.sellerid AS "sellerId", p.createdat AS "createdAt", u.email AS "sellerEmail" FROM "Product" p LEFT JOIN "User" u ON p.sellerid = u.id WHERE p.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function getBySellerId(sellerId) {
  const result = await query(
    'SELECT p.id, p.title, p.description, p.price, p.category, p.imageurl AS "imageUrl", p.sellerid AS "sellerId", p.createdat AS "createdAt", u.email AS "sellerEmail" FROM "Product" p LEFT JOIN "User" u ON p.sellerid = u.id WHERE p.sellerid = $1 ORDER BY p.createdat DESC',
    [sellerId]
  );
  return result.rows;
}

async function create({ title, description, price, category, imageUrl, sellerId }) {
  const result = await query(
    'INSERT INTO "Product" (title, description, price, category, imageurl, sellerid) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, description, price, category, imageurl AS "imageUrl", sellerid AS "sellerId", createdat AS "createdAt"',
    [title, description, price, category, imageUrl || null, sellerId]
  );
  return result.rows[0];
}

async function update(id, sellerId, { title, description, price, category, imageUrl }) {
  const result = await query(
    'UPDATE "Product" SET title = $2, description = $3, price = $4, category = $5, imageurl = $6 WHERE id = $1 AND sellerid = $7 RETURNING id, title, description, price, category, imageurl AS "imageUrl", sellerid AS "sellerId", createdat AS "createdAt"',
    [id, title, description, price, category, imageUrl ?? null, sellerId]
  );
  return result.rows[0] || null;
}

async function remove(id, sellerId) {
  const result = await query(
    'DELETE FROM "Product" WHERE id = $1 AND sellerid = $2 RETURNING id',
    [id, sellerId]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getBySellerId, create, update, remove };
