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
      deliveryotp VARCHAR(4),
      createdat TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS deliveryotp VARCHAR(4)`);
  await query(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS refundstatus TEXT`);
  await query(`UPDATE "Order" SET deliveryotp = '1234' WHERE deliveryotp IS NULL`);
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

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const insertRes = await client.query(
      `INSERT INTO "Order" (productid, buyerid, quantity, totalprice, status, buyername, buyerphone, deliveryaddress, deliverycity, deliverypincode, deliveryotp)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)
       RETURNING id, productid AS "productId", buyerid AS "buyerId", quantity, totalprice AS "totalPrice", status, buyername AS "buyerName", buyerphone AS "buyerPhone", deliveryaddress AS "deliveryAddress", deliverycity AS "deliveryCity", deliverypincode AS "deliveryPincode", deliveryotp AS "deliveryOtp", createdat AS "createdAt"`,
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
        otp
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
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const result = await query(
    `INSERT INTO "Order" (productid, buyerid, quantity, totalprice, status, buyername, buyerphone, deliveryaddress, deliverycity, deliverypincode, deliveryotp)
     VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9, $10)
     RETURNING id, productid AS "productId", buyerid AS "buyerId", quantity, totalprice AS "totalPrice", status, buyername AS "buyerName", buyerphone AS "buyerPhone", deliveryaddress AS "deliveryAddress", deliverycity AS "deliveryCity", deliverypincode AS "deliveryPincode", deliveryotp AS "deliveryOtp", createdat AS "createdAt"`,
    [productId, buyerId, quantity, totalPrice, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode, otp]
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
       COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END)::int AS "cancelledOrders",
       COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.totalprice ELSE 0 END), 0)::float AS "totalRevenue",
       COUNT(DISTINCT o.productid)::int AS "productsWithOrders",
       COUNT(CASE WHEN o.status NOT IN ('cancelled','delivered','completed') THEN 1 END)::int AS "pendingOrders",
       COUNT(CASE WHEN o.status = 'delivered' OR o.status = 'completed' THEN 1 END)::int AS "completedOrders"
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
     RETURNING o.id, o.status, o.buyerid AS "buyerId", o.deliveryotp AS "deliveryOtp"`,
    [status, orderId, sellerId]
  );
  return result.rows[0] || null;
}

// Add a helper for the controller to safely fetch the order's OTP before updating
async function getOrderOtpForSeller(orderId, sellerId) {
  await ensureOrderTable();
  const result = await query(
    `SELECT o.deliveryotp AS "deliveryOtp" 
     FROM "Order" o 
     JOIN "Product" p ON o.productid = p.id 
     WHERE o.id = $1 AND p.sellerid = $2`, 
    [orderId, sellerId]
  );
  return result.rows[0]?.deliveryOtp || null;
}

async function getPaymentSessionByOrderId(orderId) {
  await ensurePaymentSessionTable();
  await ensureOrderTable();
  // Orders from Stripe checkout have a matching PaymentSession row.
  // We need it to retrieve the Stripe sessionId → payment_intent for refund.
  const result = await query(
    `SELECT ps.sessionid AS "sessionId"
     FROM "PaymentSession" ps
     WHERE ps.status = 'completed'
       AND EXISTS (
         SELECT 1 FROM "Order" o
         WHERE o.id = $1
           AND o.buyerid = ps.buyerid
           AND o.createdat BETWEEN ps.createdat - interval '1 second' AND ps.createdat + interval '60 seconds'
       )
     LIMIT 1`,
    [orderId]
  );
  return result.rows[0]?.sessionId || null;
}

async function markOrderRefundPending(orderId) {
  await ensureOrderTable();
  await query(`UPDATE "Order" SET refundstatus = 'pending' WHERE id = $1`, [orderId]);
}

async function markOrderRefundDone(orderId) {
  await ensureOrderTable();
  await query(`UPDATE "Order" SET refundstatus = 'issued' WHERE id = $1`, [orderId]);
}

async function getOrdersForBuyer(buyerId) {
  await ensureOrderTable();
  const result = await query(
    `SELECT o.id, o.productid AS "productId", o.buyerid AS "buyerId", o.quantity,
            o.totalprice AS "totalPrice", o.status,
            o.buyername AS "buyerName", o.buyerphone AS "buyerPhone",
            o.deliveryaddress AS "deliveryAddress", o.deliverycity AS "deliveryCity",
            o.deliverypincode AS "deliveryPincode", o.deliveryotp AS "deliveryOtp",
            o.refundstatus AS "refundStatus", o.createdat AS "createdAt",
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

async function getDashboardMetrics(sellerId) {
  await ensureOrderTable();

  const statsRes = await query(
    `SELECT
       COUNT(o.id)::int AS "totalOrders",
       COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END)::int AS "cancelledOrders",
       COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.totalprice ELSE 0 END), 0)::float AS "totalRevenue"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1`, [sellerId]
  );
  
  const productsRes = await query(`SELECT COUNT(id)::int AS "listed" FROM "Product" WHERE sellerid = $1`, [sellerId]);

  const topProductRes = await query(
    `SELECT p.title, SUM(o.totalprice) AS revenue
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1 AND o.status != 'cancelled'
     GROUP BY p.title
     ORDER BY revenue DESC NULLS LAST
     LIMIT 1`, [sellerId]
  );

  const timeSeriesRes = await query(
    `SELECT TO_CHAR(o.createdat, 'YYYY-MM-DD') AS "date", 
            SUM(o.totalprice)::float AS "revenue", 
            COUNT(o.id)::int AS "orders"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1 AND o.createdat >= current_date - interval '30 days'
       AND o.status != 'cancelled'
     GROUP BY TO_CHAR(o.createdat, 'YYYY-MM-DD')
     ORDER BY "date" ASC`, [sellerId]
  );

  const topListRes = await query(
    `SELECT p.title, SUM(o.quantity)::int AS "unitsSold", SUM(o.totalprice)::float AS "revenue"
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1 AND o.status != 'cancelled'
     GROUP BY p.title
     ORDER BY "revenue" DESC NULLS LAST
     LIMIT 5`, [sellerId]
  );

  const recentRes = await query(
    `SELECT o.id, p.title AS "productTitle", o.buyername AS "buyerName", o.totalprice AS "amount", o.status
     FROM "Order" o
     JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1
     ORDER BY o.createdat DESC
     LIMIT 5`, [sellerId]
  );

  const insightCurrentRes = await query(
    `SELECT COALESCE(SUM(o.totalprice), 0)::float AS rev
     FROM "Order" o JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1 AND o.createdat >= current_date - interval '7 days'
       AND o.status != 'cancelled'`, [sellerId]
  );
  const insightPrevRes = await query(
    `SELECT COALESCE(SUM(o.totalprice), 0)::float AS rev
     FROM "Order" o JOIN "Product" p ON o.productid = p.id
     WHERE p.sellerid = $1 
       AND o.createdat >= current_date - interval '14 days'
       AND o.createdat < current_date - interval '7 days'
       AND o.status != 'cancelled'`, [sellerId]
  );
  
  const current7 = insightCurrentRes.rows[0].rev || 0;
  const prev7 = insightPrevRes.rows[0].rev || 0;
  let insightString = "You haven't made any sales yet. Share your products to get started!";
  if (prev7 > 0) {
    const change = ((current7 - prev7) / prev7) * 100;
    if (change > 0) {
      insightString = "Your revenue increased by " + change.toFixed(1) + "% this week compared to last week.";
    } else if (change < 0) {
      insightString = "Your revenue decreased by " + Math.abs(change).toFixed(1) + "% this week compared to last week.";
    } else {
      insightString = "Your revenue remained exactly the same as last week.";
    }
  } else if (current7 > 0) {
    insightString = "Great start! You made ₹" + current7.toLocaleString('en-IN') + " this week.";
  }

  return {
    summary: {
      totalRevenue: statsRes.rows[0].totalRevenue || 0,
      // totalOrders = all orders placed (including cancelled) for informational value
      totalOrders: statsRes.rows[0].totalOrders || 0,
      cancelledOrders: statsRes.rows[0].cancelledOrders || 0,
      activeOrders: (statsRes.rows[0].totalOrders || 0) - (statsRes.rows[0].cancelledOrders || 0),
      productsListed: productsRes.rows[0].listed || 0,
      bestSellingProduct: topProductRes.rows[0]?.title || 'None'
    },
    revenueOverTime: timeSeriesRes.rows,
    topSellingProducts: topListRes.rows,
    recentOrders: recentRes.rows,
    insight: insightString
  };
}

module.exports = {
  createOrder,
  createOrderRecord,
  getOrdersForSeller,
  getOrderOtpForSeller,
  getSellerStats,
  getDashboardMetrics,
  updateOrderStatus,
  getOrdersForBuyer,
  hasProcessedPaymentSession,
  acquirePaymentSessionProcessing,
  markPaymentSessionProcessed,
  markPaymentSessionFailed,
  getPaymentSession,
  getPaymentSessionByOrderId,
  markOrderRefundPending,
  markOrderRefundDone,
};
