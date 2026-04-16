const { query } = require('../db');

let schemaEnsured = false;
let schemaPromise = null;

async function ensureDatabaseSchema() {
  if (schemaEnsured) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS "User" (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        createdat TIMESTAMP DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'buyer'`);

    await query(`
      CREATE TABLE IF NOT EXISTS "Product" (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        category TEXT NOT NULL,
        imageurl TEXT,
        sellerid INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        createdat TIMESTAMP DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 1`);

    await query(`
      CREATE TABLE IF NOT EXISTS "Chat" (
        id SERIAL PRIMARY KEY,
        userid INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        createdat TIMESTAMP DEFAULT NOW()
      )
    `);

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
    await query(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS deliveryotp VARCHAR(4)`);
    await query(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS refundstatus TEXT`);
    await query(`UPDATE "Order" SET deliveryotp = '1234' WHERE deliveryotp IS NULL`);

    await query(`
      CREATE TABLE IF NOT EXISTS "PaymentSession" (
        sessionid TEXT PRIMARY KEY,
        buyerid INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'processing',
        createdat TIMESTAMP DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE "PaymentSession" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing'`);

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

    schemaEnsured = true;
  })()
    .catch((err) => {
      schemaEnsured = false;
      throw err;
    })
    .finally(() => {
      schemaPromise = null;
    });

  await schemaPromise;
}

module.exports = { ensureDatabaseSchema };
