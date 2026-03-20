const { query } = require('./db');
const notificationService = require('./services/notificationService');
const orderService = require('./services/orderService');
const productService = require('./services/productService');

async function testPersistence() {
  console.log('--- STARTING PERSISTENT NOTIFICATION TEST ---');
  
  try {
    // 1. Setup: Find or create a seller and a product
    const sellerRes = await query('SELECT id FROM "User" LIMIT 1');
    const sellerId = sellerRes.rows[0].id;
    
    const productRes = await query('SELECT id FROM "Product" WHERE sellerid = $1 LIMIT 1', [sellerId]);
    const productId = productRes.rows[0].id;

    console.log(`[Test] Using Seller ID: ${sellerId}, Product ID: ${productId}`);

    // 2. Simulate placing an order (this triggers Notification creation in real logic)
    // We'll manually call notificationService.createNotification to see if it saves
    console.log('[Test] Simulated: Buyer places an order while Seller is offline...');
    const payload = {
      orderId: 9999,
      buyerName: 'Test Buyer',
      totalAmount: 150.00,
      timestamp: new Date()
    };
    
    const notifId = await notificationService.createNotification(sellerId, 'order:new', payload);
    console.log(`[Test] Notification saved to DB with ID: ${notifId}`);

    // 3. Verify it's in the unread list
    const unread = await notificationService.getUnreadNotifications(sellerId);
    const found = unread.find(n => n.id === notifId);
    if (found) {
      console.log('✅ Success: Unread notification found in catch-up list.');
    } else {
      throw new Error('❌ Failure: Notification not found in unread list.');
    }

    // 4. Simulate Socket ACK (mark as read)
    console.log(`[Test] Simulated: Seller connects, Socket.IO emits, and receives ACK for ID: ${notifId}`);
    await notificationService.markAsRead(notifId);
    
    // 5. Verify it's gone from unread
    const unreadAfter = await notificationService.getUnreadNotifications(sellerId);
    if (!unreadAfter.find(n => n.id === notifId)) {
      console.log('✅ Success: Notification correctly marked as READ and removed from catch-up queue.');
    } else {
      throw new Error('❌ Failure: Notification still marked as UNREAD after markAsRead().');
    }

    console.log('--- TEST COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('--- TEST FAILED ---');
    console.error(err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testPersistence();
