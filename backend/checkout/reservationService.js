const crypto = require('crypto');
const { query, pool } = require('../db');

let reservationTableEnsured = false;
let reservationEnsurePromise = null;

const RESERVATION_STATUS = {
  ACTIVE: 'active',
  CONSUMED: 'consumed',
  RELEASED: 'released',
};

async function ensureReservationTable() {
  if (reservationTableEnsured) return;
  if (reservationEnsurePromise) {
    await reservationEnsurePromise;
    return;
  }

  reservationEnsurePromise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS "StockReservation" (
          id SERIAL PRIMARY KEY,
          reservationid TEXT NOT NULL,
          productid INTEGER NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
          buyerid INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL,
          unitprice DOUBLE PRECISION NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          reserveduntil TIMESTAMP NOT NULL,
          stripesessionid TEXT,
          createdat TIMESTAMP DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS stock_reservation_reservationid_idx ON "StockReservation"(reservationid)`);
      await query(`CREATE INDEX IF NOT EXISTS stock_reservation_stripesessionid_idx ON "StockReservation"(stripesessionid)`);
      await query(`CREATE INDEX IF NOT EXISTS stock_reservation_status_reserveduntil_idx ON "StockReservation"(status, reserveduntil)`);
      reservationTableEnsured = true;
    } catch (err) {
      const code = err && typeof err === 'object' ? err.code : undefined;
      const constraint = err && typeof err === 'object' ? err.constraint : undefined;
      if (code === '42P07' || (code === '23505' && constraint === 'pg_type_typname_nsp_index')) {
        reservationTableEnsured = true;
        return;
      }
      throw err;
    } finally {
      reservationEnsurePromise = null;
    }
  })();

  await reservationEnsurePromise;
}

function normalizeItems(items) {
  const bucket = new Map();
  for (const item of items || []) {
    const productId = parseInt(item?.productId, 10);
    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    if (!Number.isFinite(productId) || productId <= 0) continue;
    bucket.set(productId, (bucket.get(productId) || 0) + quantity);
  }
  return Array.from(bucket.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

function keyFromLines(lines) {
  return lines
    .map((l) => `${Number(l.productId)}:${Number(l.quantity)}`)
    .sort()
    .join('|');
}

async function reserveItemsForCheckout({ buyerId, items, ttlMinutes = 10 }) {
  await ensureReservationTable();
  const normalized = normalizeItems(items);
  if (!normalized.length) {
    const err = new Error('No valid checkout items');
    err.status = 400;
    throw err;
  }

  const reservationId = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reservedUntil = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const reservedLines = [];

    for (const item of normalized) {
      const productRes = await client.query(
        `SELECT id, title, category, price, stock, sellerid AS "sellerId"
         FROM "Product"
         WHERE id = $1
         FOR UPDATE`,
        [item.productId]
      );
      const product = productRes.rows[0];
      if (!product) {
        const err = new Error(`Product ${item.productId} not found`);
        err.status = 404;
        throw err;
      }
      if (Number(product.sellerId) === Number(buyerId)) {
        const err = new Error('You cannot buy your own listing');
        err.status = 403;
        throw err;
      }

      const updateRes = await client.query(
        `UPDATE "Product"
         SET stock = stock - $1
         WHERE id = $2 AND stock >= $1
         RETURNING id`,
        [item.quantity, item.productId]
      );
      if (!updateRes.rowCount) {
        const err = new Error(`Insufficient stock for product ${item.productId}`);
        err.status = 409;
        throw err;
      }

      const unitPrice = parseFloat(product.price);
      await client.query(
        `INSERT INTO "StockReservation"
         (reservationid, productid, buyerid, quantity, unitprice, status, reserveduntil)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          reservationId,
          item.productId,
          buyerId,
          item.quantity,
          unitPrice,
          RESERVATION_STATUS.ACTIVE,
          reservedUntil,
        ]
      );

      reservedLines.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        title: product.title,
        category: product.category,
      });
    }

    await client.query('COMMIT');
    return { reservationId, reservedUntil, lines: reservedLines };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

async function findReusableActiveReservation({ buyerId, items }) {
  await ensureReservationTable();
  const normalized = normalizeItems(items);
  if (!normalized.length) return null;
  const wantedKey = keyFromLines(normalized);

  const result = await query(
    `SELECT reservationid AS "reservationId",
            productid AS "productId",
            quantity,
            unitprice AS "unitPrice",
            reserveduntil AS "reservedUntil",
            stripesessionid AS "stripeSessionId",
            p.title AS "title",
            p.category AS "category"
     FROM "StockReservation" sr
     JOIN "Product" p ON sr.productid = p.id
     WHERE sr.buyerid = $1
       AND sr.status = $2
       AND sr.reserveduntil > NOW()
     ORDER BY sr.reservationid, sr.productid`,
    [buyerId, RESERVATION_STATUS.ACTIVE]
  );

  const byReservation = new Map();
  for (const row of result.rows) {
    const bucket = byReservation.get(row.reservationId) || [];
    bucket.push(row);
    byReservation.set(row.reservationId, bucket);
  }

  for (const [reservationId, lines] of byReservation.entries()) {
    const reservationKey = keyFromLines(lines);
    if (reservationKey !== wantedKey) continue;
    const first = lines[0];
    return {
      reservationId,
      reservedUntil: first.reservedUntil,
      stripeSessionId: first.stripeSessionId || null,
      lines: lines.map((l) => ({
        productId: Number(l.productId),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        title: l.title,
        category: l.category,
      })),
    };
  }

  return null;
}

async function attachStripeSessionToReservation(reservationId, stripeSessionId) {
  await ensureReservationTable();
  await query(
    `UPDATE "StockReservation"
     SET stripesessionid = $1
     WHERE reservationid = $2 AND status = $3`,
    [stripeSessionId, reservationId, RESERVATION_STATUS.ACTIVE]
  );
}

async function releaseReservationById(reservationId) {
  await ensureReservationTable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rowsRes = await client.query(
      `SELECT id, productid AS "productId", quantity
       FROM "StockReservation"
       WHERE reservationid = $1 AND status = $2
       FOR UPDATE`,
      [reservationId, RESERVATION_STATUS.ACTIVE]
    );
    const rows = rowsRes.rows;
    if (!rows.length) {
      await client.query('COMMIT');
      return 0;
    }
    for (const row of rows) {
      await client.query(
        `UPDATE "Product" SET stock = stock + $1 WHERE id = $2`,
        [row.quantity, row.productId]
      );
    }
    await client.query(
      `UPDATE "StockReservation"
       SET status = $2
       WHERE reservationid = $1 AND status = $3`,
      [reservationId, RESERVATION_STATUS.RELEASED, RESERVATION_STATUS.ACTIVE]
    );
    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

async function consumeReservationBySession({ sessionId, buyerId }) {
  await ensureReservationTable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT id, reservationid AS "reservationId", productid AS "productId", quantity, unitprice AS "unitPrice",
              status, reserveduntil AS "reservedUntil", buyerid AS "buyerId"
       FROM "StockReservation"
       WHERE stripesessionid = $1
       FOR UPDATE`,
      [sessionId]
    );
    const rows = res.rows;
    if (!rows.length) {
      const err = new Error('No reservation found for this checkout session');
      err.status = 404;
      throw err;
    }
    if (rows.some((r) => Number(r.buyerId) !== Number(buyerId))) {
      const err = new Error('This checkout reservation does not belong to you');
      err.status = 403;
      throw err;
    }
    if (rows.every((r) => r.status === RESERVATION_STATUS.CONSUMED)) {
      await client.query('COMMIT');
      return { alreadyConsumed: true, lines: rows };
    }
    if (rows.some((r) => r.status === RESERVATION_STATUS.RELEASED)) {
      const err = new Error('Reservation is no longer active');
      err.status = 409;
      throw err;
    }
    const now = new Date();
    if (rows.some((r) => new Date(r.reservedUntil).getTime() < now.getTime())) {
      const reservationId = rows[0].reservationId;
      for (const row of rows.filter((r) => r.status === RESERVATION_STATUS.ACTIVE)) {
        await client.query(`UPDATE "Product" SET stock = stock + $1 WHERE id = $2`, [row.quantity, row.productId]);
      }
      await client.query(
        `UPDATE "StockReservation"
         SET status = $2
         WHERE reservationid = $1 AND status = $3`,
        [reservationId, RESERVATION_STATUS.RELEASED, RESERVATION_STATUS.ACTIVE]
      );
      const err = new Error('Reservation expired');
      err.status = 409;
      throw err;
    }

    const reservationId = rows[0].reservationId;
    await client.query(
      `UPDATE "StockReservation"
       SET status = $2
       WHERE reservationid = $1 AND status = $3`,
      [reservationId, RESERVATION_STATUS.CONSUMED, RESERVATION_STATUS.ACTIVE]
    );
    await client.query('COMMIT');
    return { alreadyConsumed: false, lines: rows };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

async function releaseExpiredReservations() {
  await ensureReservationTable();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = await client.query(
      `SELECT id, reservationid AS "reservationId", productid AS "productId", quantity
       FROM "StockReservation"
       WHERE status = $1 AND reserveduntil < NOW()
       FOR UPDATE`,
      [RESERVATION_STATUS.ACTIVE]
    );
    if (!expired.rows.length) {
      await client.query('COMMIT');
      return 0;
    }
    for (const row of expired.rows) {
      await client.query(`UPDATE "Product" SET stock = stock + $1 WHERE id = $2`, [row.quantity, row.productId]);
    }
    await client.query(
      `UPDATE "StockReservation"
       SET status = $2
       WHERE status = $1 AND reserveduntil < NOW()`,
      [RESERVATION_STATUS.ACTIVE, RESERVATION_STATUS.RELEASED]
    );
    await client.query('COMMIT');
    return expired.rows.length;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  reserveItemsForCheckout,
  findReusableActiveReservation,
  attachStripeSessionToReservation,
  releaseReservationById,
  consumeReservationBySession,
  releaseExpiredReservations,
  RESERVATION_STATUS,
};

