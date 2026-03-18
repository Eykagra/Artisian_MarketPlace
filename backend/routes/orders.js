const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/products/:productId/orders', requireAuth, orderController.placeOrder);
router.get('/seller/orders', requireAuth, orderController.mySellerOrders);
router.get('/seller/stats', requireAuth, orderController.sellerStats);
router.patch('/orders/:orderId/status', requireAuth, orderController.updateOrderStatus);
router.get('/buyer/orders', requireAuth, orderController.myBuyerOrders);

module.exports = router;
