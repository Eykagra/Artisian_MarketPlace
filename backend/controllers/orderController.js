const orderService = require('../services/orderService');

const productService = require('../services/productService');

async function placeOrder(req, res) {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const product = await productService.getById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.sellerId === buyerId) {
      return res.status(403).json({ error: 'You cannot buy your own listing' });
    }

    const { buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode, quantity } = req.body;
    if (!buyerName || !buyerPhone || !deliveryAddress || !deliveryCity || !deliveryPincode) {
      return res.status(400).json({ error: 'All delivery details are required' });
    }
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const totalPrice = parseFloat(product.price) * qty;

    const order = await orderService.createOrder({
      productId,
      buyerId,
      quantity: qty,
      totalPrice,
      buyerName: String(buyerName),
      buyerPhone: String(buyerPhone),
      deliveryAddress: String(deliveryAddress),
      deliveryCity: String(deliveryCity),
      deliveryPincode: String(deliveryPincode),
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Place order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
}

async function mySellerOrders(req, res) {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const orders = await orderService.getOrdersForSeller(sellerId);
    res.json(orders);
  } catch (err) {
    console.error('Seller orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function sellerStats(req, res) {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const stats = await orderService.getSellerStats(sellerId);
    res.json(stats);
  } catch (err) {
    console.error('Seller stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const updated = await orderService.updateOrderStatus(orderId, sellerId, status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found or you do not own the product' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
}

async function myBuyerOrders(req, res) {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) return res.status(401).json({ error: 'Authentication required' });
    const orders = await orderService.getOrdersForBuyer(buyerId);
    res.json(orders);
  } catch (err) {
    console.error('Buyer orders error:', err);
    res.status(500).json({ error: 'Failed to fetch your orders' });
  }
}

module.exports = { placeOrder, mySellerOrders, sellerStats, updateOrderStatus, myBuyerOrders };
