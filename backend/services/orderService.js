const { query } = require('../db');

async function ensureOrderTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS "Order" (
      id SERIAL PRIMARY KEY,
      productid INTEGER NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
      buyerid INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      totalprice DOUBLE PRECISION NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      buyername TEXT NOT NULL,
      buyerphone TEXT NOT NULL,
      deliveryaddress TEXT NOT NULL,
      deliverycity TEXT NOT NULL,
      deliverypincode TEXT NOT NULL,
      createdat TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function createOrder({ productId, buyerId, quantity, totalPrice, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode }) {
  await ensureOrderTable();
  const result = await query(
    `INSERT INTO "Order" (productid, buyerid, quantity, totalprice, status, buyername, buyerphone, deliveryaddress, deliverycity, deliverypincode)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
     RETURNING id, productid AS "productId", buyerid AS "buyerId", quantity, totalprice AS "totalPrice", status, buyername AS "buyerName", buyerphone AS "buyerPhone", deliveryaddress AS "deliveryAddress", deliverycity AS "deliveryCity", deliverypincode AS "deliveryPincode", createdat AS "createdAt"`,
    [productId, buyerId, quantity, totalPrice, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode]
  );
  return result.rows[0];
}

async function getOrdersForSeller(sellerId) {
  await ensureOrderTable();
  const result = await query(
    `SELECT o.id, o.productid AS "productId", o.buyerid AS "buyerId", o.quantity, o.totalprice AS "totalPrice",
            o.status, o.buyername AS "buyerName", o.buyerphone AS "buyerPhone",
            o.deliveryaddress AS "deliveryAddress", o.deliverycity AS "deliveryCity",
            o.deliverypincode AS "deliveryPincode", o.createdat AS "createdAt",
            p.title AS "productTitle", p.price AS "productPrice",
            u.email AS "buyerEmail"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     JOIN "User" u ON o.buyerid = u.id
     WHERE p.sellerid = $1
     ORDER BY o.createdat DESC`,
    [sellerId]
  );
  return result.rows;
}

async function getSellerStats(sellerId) {
  await ensureOrderTable();
  const result = await query(
    `SELECT
       COUNT(o.id)::int AS "totalOrders",
       COALESCE(SUM(o.totalprice), 0)::float AS "totalRevenue",
       COUNT(DISTINCT o.productid)::int AS "productsWithOrders",
       COUNT(CASE WHEN o.status = 'pending' THEN 1 END)::int AS "pendingOrders",
       COUNT(CASE WHEN o.status = 'completed' THEN 1 END)::int AS "completedOrders"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1`,
    [sellerId]
  );
  return result.rows[0];
}

async function updateOrderStatus(orderId, sellerId, status) {
  await ensureOrderTable();
  const result = await query(
    `UPDATE "Order" o SET status = $1
     FROM "Product" p
     WHERE o.id = $2 AND o.productid = p.id AND p.sellerid = $3
     RETURNING o.id, o.status`,
    [status, orderId, sellerId]
  );
  return result.rows[0] || null;
}

module.exports = { createOrder, getOrdersForSeller, getSellerStats, updateOrderStatus };
