const { query } = require('./db');
async function run() {
  try {
    await query(`UPDATE "Order" SET status = 'confirmed' WHERE status = 'pending'`);
    console.log("Fixed legacy orders.");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
