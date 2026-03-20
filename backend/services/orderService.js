const { query, pool } = require('../db');
let paymentSessionTableEnsured = false;
let paymentSessionEnsurePromise = null;

async function ensureStockColumn() {
  await query(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 1`);
}

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

async function ensurePaymentSessionTable() {
  if (paymentSessionTableEnsured) return;
  if (paymentSessionEnsurePromise) {
    await paymentSessionEnsurePromise;
    return;
  }

  paymentSessionEnsurePromise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS "PaymentSession" (
          sessionid TEXT PRIMARY KEY,
          buyerid INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'processing',
          createdat TIMESTAMP DEFAULT NOW()
        )
      `);
      await query(`ALTER TABLE "PaymentSession" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing'`);
      paymentSessionTableEnsured = true;
    } catch (err) {
      // Under concurrent CREATE TABLE calls Postgres can occasionally raise catalog
      // duplicate-key errors even with IF NOT EXISTS. Treat as "already created".
      const code = err && typeof err === 'object' ? err.code : undefined;
      const constraint = err && typeof err === 'object' ? err.constraint : undefined;
      if (code === '42P07' || (code === '23505' && constraint === 'pg_type_typname_nsp_index')) {
        paymentSessionTableEnsured = true;
        return;
      }
      throw err;
    } finally {
      paymentSessionEnsurePromise = null;
    }
  })();

  await paymentSessionEnsurePromise;
}

async function createOrder({ productId, buyerId, quantity, totalPrice, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode }) {
  await ensureOrderTable();
  await ensureStockColumn();

  // Use a DB transaction so stock check + decrement + order creation are consistent.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE "Product"
       SET stock = stock - $1
       WHERE id = $2 AND stock >= $1
       RETURNING id`,
      [quantity, productId]
    );

    if (!updateRes.rowCount) {
      const err = new Error(`Insufficient stock for product ${productId}`);
      // Used by controller to choose proper HTTP status.
      err.status = 409;
      throw err;
    }

    const insertRes = await client.query(
      `INSERT INTO "Order" (productid, buyerid, quantity, totalprice, status, buyername, buyerphone, deliveryaddress, deliverycity, deliverypincode)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
       RETURNING id, productid AS "productId", buyerid AS "buyerId", quantity, totalprice AS "totalPrice", status, buyername AS "buyerName", buyerphone AS "buyerPhone", deliveryaddress AS "deliveryAddress", deliverycity AS "deliveryCity", deliverypincode AS "deliveryPincode", createdat AS "createdAt"`,
      [
        productId,
        buyerId,
        quantity,
        totalPrice,
        buyerName,
        buyerPhone,
        deliveryAddress,
        deliveryCity,
        deliveryPincode,
      ]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw err;
  } finally {
    client.release();
  }
}

async function createOrderRecord({ productId, buyerId, quantity, totalPrice, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode }) {
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

async function getOrdersForBuyer(buyerId) {
  await ensureOrderTable();
  const result = await query(
    `SELECT o.id, o.productid AS "productId", o.buyerid AS "buyerId", o.quantity,
            o.totalprice AS "totalPrice", o.status,
            o.buyername AS "buyerName", o.buyerphone AS "buyerPhone",
            o.deliveryaddress AS "deliveryAddress", o.deliverycity AS "deliveryCity",
            o.deliverypincode AS "deliveryPincode", o.createdat AS "createdAt",
            p.title AS "productTitle", p.price AS "productPrice", p.imageurl AS "productImageUrl",
            u.email AS "sellerEmail"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     JOIN "User" u ON p.sellerid = u.id
     WHERE o.buyerid = $1
     ORDER BY o.createdat DESC`,
    [buyerId]
  );
  return result.rows;
}

async function hasProcessedPaymentSession(sessionId) {
  await ensurePaymentSessionTable();
  const result = await query(
    `SELECT sessionid FROM "PaymentSession" WHERE sessionid = $1 AND status = 'completed'`,
    [sessionId]
  );
  return !!result.rows[0];
}

async function acquirePaymentSessionProcessing(sessionId, buyerId) {
  await ensurePaymentSessionTable();
  const result = await query(
    `INSERT INTO "PaymentSession" (sessionid, buyerid, status)
     VALUES ($1, $2, 'processing')
     ON CONFLICT (sessionid) DO NOTHING
     RETURNING sessionid`,
    [sessionId, buyerId]
  );
  return !!result.rows[0];
}

async function markPaymentSessionProcessed(sessionId, buyerId) {
  await ensurePaymentSessionTable();
  const result = await query(
    `UPDATE "PaymentSession"
     SET status = 'completed'
     WHERE sessionid = $1 AND buyerid = $2
     RETURNING sessionid`,
    [sessionId, buyerId]
  );
  return !!result.rows[0];
}

async function markPaymentSessionFailed(sessionId, buyerId) {
  await ensurePaymentSessionTable();
  const result = await query(
    `UPDATE "PaymentSession"
     SET status = 'failed'
     WHERE sessionid = $1 AND buyerid = $2
     RETURNING sessionid`,
    [sessionId, buyerId]
  );
  return !!result.rows[0];
}

async function getPaymentSession(sessionId) {
  await ensurePaymentSessionTable();
  const result = await query(
    `SELECT sessionid, buyerid AS "buyerId", status FROM "PaymentSession" WHERE sessionid = $1`,
    [sessionId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createOrder,
  createOrderRecord,
  getOrdersForSeller,
  getSellerStats,
  updateOrderStatus,
  getOrdersForBuyer,
  hasProcessedPaymentSession,
  acquirePaymentSessionProcessing,
  markPaymentSessionProcessed,
  markPaymentSessionFailed,
  getPaymentSession,
};
