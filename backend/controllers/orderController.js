const orderService = require('../services/orderService');

const productService = require('../services/productService');
const stripeService = require('../services/stripeService');
const reservationService = require('../checkout/reservationService');
const notificationService = require('../services/notificationService');
const { emitToUser } = require('../socket');

function parseItemsString(itemsString) {
  // Format: "productId:qty|productId:qty"
  if (!itemsString || typeof itemsString !== 'string') return [];
  return itemsString
    .split('|')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [idRaw, qtyRaw] = pair.split(':');
      const productId = parseInt(idRaw, 10);
      const quantity = Math.max(1, parseInt(qtyRaw, 10) || 1);
      return { productId, quantity };
    })
    .filter((x) => Number.isFinite(x.productId) && x.productId > 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSessionFinalStatus(sessionId, timeoutMs = 5000, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const s = await orderService.getPaymentSession(sessionId);
    if (s && (s.status === 'completed' || s.status === 'failed')) return s;
    await sleep(intervalMs);
  }
  return orderService.getPaymentSession(sessionId);
}

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

    const notifPayload = {
      orderId: order.id,
      buyerName: order.buyerName,
      totalAmount: order.totalPrice,
      timestamp: order.createdAt || new Date()
    };
    
    // Save for offline catch-up
    await notificationService.createNotification(product.sellerId, 'order:new', notifPayload);

    emitToUser(product.sellerId, 'order:new', notifPayload);

    res.status(201).json(order);
  } catch (err) {
    console.error('Place order error:', err);
    const status = (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number') ? err.status : 500;
    const message = (err instanceof Error && err.message) ? err.message : 'Failed to place order';
    res.status(status).json({ error: message });
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

async function sellerDashboard(req, res) {
  try {
    const sellerId = req.user?.userId;
    if (!sellerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const dashboardData = await orderService.getDashboardMetrics(sellerId);
    res.json(dashboardData);
  } catch (err) {
    console.error('Fetch seller dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch seller dashboard insights' });
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
    const { status, otp } = req.body;
    const allowed = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled', 'delivered'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    if (status === 'delivered') {
      if (!otp) {
        return res.status(400).json({ error: 'Delivery OTP is required to mark as delivered.' });
      }
      const actualOtp = await orderService.getOrderOtpForSeller(orderId, sellerId);
      if (!actualOtp) {
        return res.status(404).json({ error: 'Order not found or you do not own the product.' });
      }
      if (String(actualOtp).trim() !== String(otp).trim()) {
        return res.status(400).json({ error: 'Invalid Delivery OTP. Please ask the buyer for the correct 4-digit code.' });
      }
    }

    const updated = await orderService.updateOrderStatus(orderId, sellerId, status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found or you do not own the product' });
    }

    // ── Cancellation: trigger Stripe refund + notify buyer ─────────────────
    if (status === 'cancelled') {
      // Fire-and-forget refund — don't block the response
      (async () => {
        try {
          const stripeSessionId = await orderService.getPaymentSessionByOrderId(orderId);
          if (stripeSessionId) {
            const session = await stripeService.retrieveCheckoutSession(stripeSessionId);
            if (session?.payment_intent && session?.payment_status === 'paid') {
              await stripeService.refundPaymentIntent(session.payment_intent);
              await orderService.markOrderRefundPending(orderId);
              console.log(`[Refund] Stripe refund issued for order #${orderId}`);
            }
          }
        } catch (refundErr) {
          console.error(`[Refund] Failed to refund order #${orderId}:`, refundErr.message);
        }
      })();

      // Notify buyer in real-time
      const cancelPayload = {
        orderId: updated.id,
        message: 'Your order has been cancelled by the seller. If you paid online, your refund will be credited within 3 business days.'
      };
      await notificationService.createNotification(updated.buyerId, 'order:cancelled', cancelPayload);
      emitToUser(updated.buyerId, 'order:cancelled', cancelPayload);
    }

    const updatePayload = {
      orderId: updated.id,
      status: updated.status
    };
    await notificationService.createNotification(updated.buyerId, 'order:update', updatePayload);
    emitToUser(updated.buyerId, 'order:update', updatePayload);

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

async function createCheckoutSession(req, res) {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) return res.status(401).json({ error: 'Authentication required' });

    const { items, buyerName, buyerPhone, deliveryAddress, deliveryCity, deliveryPincode } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (!buyerName || !buyerPhone || !deliveryAddress || !deliveryCity || !deliveryPincode) {
      return res.status(400).json({ error: 'All delivery details are required' });
    }

    let reservation = await reservationService.findReusableActiveReservation({
      buyerId,
      items,
    });
    let createdReservationThisRequest = false;

    if (!reservation) {
      reservation = await reservationService.reserveItemsForCheckout({
        buyerId,
        items,
        ttlMinutes: 10,
      });
      createdReservationThisRequest = true;
    }

    let session;
    if (reservation.stripeSessionId) {
      try {
        const existingSession = await stripeService.retrieveCheckoutSession(reservation.stripeSessionId);
        // Reuse existing unpaid/open session for same active reservation.
        if (existingSession && existingSession.payment_status !== 'paid' && existingSession.status === 'open') {
          return res.status(201).json({ id: existingSession.id, url: existingSession.url });
        }
      } catch {
        // If retrieval fails (expired/invalid), create a fresh session below.
      }
    }

    try {
      const lineItems = reservation.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: 'inr',
          unit_amount: Math.round(line.unitPrice * 100),
          product_data: {
            name: line.title,
            description: line.category,
          },
        },
      }));
      const expectedAmountTotal = reservation.lines.reduce(
        (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
        0
      );

      session = await stripeService.createCheckoutSession({
        lineItems,
        metadata: {
          buyerId: String(buyerId),
          buyerName: String(buyerName),
          buyerPhone: String(buyerPhone),
          deliveryAddress: String(deliveryAddress),
          deliveryCity: String(deliveryCity),
          deliveryPincode: String(deliveryPincode),
          reservationId: reservation.reservationId,
          expectedAmountTotal: String(expectedAmountTotal),
        },
      });
    } catch (stripeErr) {
      // If this reservation was newly created in this request, release it.
      // Reused reservation should remain active until natural expiry.
      if (createdReservationThisRequest) {
        await reservationService.releaseReservationById(reservation.reservationId);
      }
      throw stripeErr;
    }

    await reservationService.attachStripeSessionToReservation(reservation.reservationId, session.id);

    return res.status(201).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    const status =
      err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return res.status(status).json({ error: message });
  }
}

async function confirmCheckoutSession(req, res) {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) return res.status(401).json({ error: 'Authentication required' });

    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const alreadyProcessed = await orderService.hasProcessedPaymentSession(sessionId);
    if (alreadyProcessed) {
      return res.json({ ok: true, alreadyProcessed: true });
    }

    const acquired = await orderService.acquirePaymentSessionProcessing(sessionId, buyerId);
    if (!acquired) {
      const existing = await orderService.getPaymentSession(sessionId);
      if (existing && Number(existing.buyerId) !== Number(buyerId)) {
        return res.status(403).json({ error: 'This payment session does not belong to you' });
      }
      if (existing && existing.status === 'completed') {
        return res.json({ ok: true, alreadyProcessed: true });
      }
      if (existing && existing.status === 'failed') {
        return res.status(409).json({ error: 'Order could not be fulfilled. Payment was refunded.' });
      }

      // If currently processing, wait briefly for final state instead of optimistic success.
      const settled = await waitForSessionFinalStatus(sessionId);
      if (settled?.status === 'completed') {
        return res.json({ ok: true, alreadyProcessed: true });
      }
      if (settled?.status === 'failed') {
        return res.status(409).json({ error: 'Order could not be fulfilled. Payment was refunded.' });
      }
      return res.status(202).json({ ok: false, processing: true });
    }

    const session = await stripeService.retrieveCheckoutSession(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const metadata = session.metadata || {};
    if (String(metadata.buyerId || '') !== String(buyerId)) {
      return res.status(403).json({ error: 'This payment session does not belong to you' });
    }
    const reservationId = String(metadata.reservationId || '');
    if (!reservationId) return res.status(400).json({ error: 'Missing reservation metadata' });

    const buyerName = String(metadata.buyerName || '');
    const buyerPhone = String(metadata.buyerPhone || '');
    const deliveryAddress = String(metadata.deliveryAddress || '');
    const deliveryCity = String(metadata.deliveryCity || '');
    const deliveryPincode = String(metadata.deliveryPincode || '');
    if (!buyerName || !buyerPhone || !deliveryAddress || !deliveryCity || !deliveryPincode) {
      return res.status(400).json({ error: 'Missing delivery details in checkout session' });
    }

    let consumed;
    try {
      consumed = await reservationService.consumeReservationBySession({
        sessionId,
        buyerId,
      });
    } catch (err) {
      const isConflict = err && typeof err === 'object' && 'status' in err && Number(err.status) === 409;
      if (isConflict && session.payment_status === 'paid') {
        try {
          await stripeService.refundPaymentIntent(session.payment_intent);
        } catch (refundErr) {
          console.error('Refund failed after reservation conflict:', refundErr);
        }
        await orderService.markPaymentSessionFailed(sessionId, buyerId);
        return res.status(409).json({ error: 'Item reservation expired. Payment has been refunded.' });
      }
      throw err;
    }

    if (consumed.alreadyConsumed) {
      await orderService.markPaymentSessionProcessed(sessionId, buyerId);
      return res.json({ ok: true, alreadyProcessed: true });
    }

    const recalculated = consumed.lines.reduce(
      (sum, line) => sum + Math.round(parseFloat(line.unitPrice) * 100) * line.quantity,
      0
    );
    if (Number(session.amount_total) !== recalculated) {
      if (session.payment_status === 'paid') {
        try {
          await stripeService.refundPaymentIntent(session.payment_intent);
        } catch (refundErr) {
          console.error('Refund failed after amount mismatch:', refundErr);
        }
      }
      await orderService.markPaymentSessionFailed(sessionId, buyerId);
      return res.status(400).json({ error: 'Amount mismatch for checkout session. Payment refunded.' });
    }

    const createdOrders = [];
    try {
      for (const line of consumed.lines) {
        const totalPrice = parseFloat(line.unitPrice) * line.quantity;
        const order = await orderService.createOrderRecord({
          productId: line.productId,
          buyerId,
          quantity: line.quantity,
          totalPrice,
          buyerName,
          buyerPhone,
          deliveryAddress,
          deliveryCity,
          deliveryPincode,
        });

        const product = await productService.getById(line.productId);
        if (product && product.sellerId) {
          const stripeNotifPayload = {
            orderId: order.id,
            buyerName: order.buyerName,
            totalAmount: order.totalPrice,
            timestamp: order.createdAt || new Date()
          };
          await notificationService.createNotification(product.sellerId, 'order:new', stripeNotifPayload);
          emitToUser(product.sellerId, 'order:new', stripeNotifPayload);
        }

        createdOrders.push(order);
      }
    } catch (err) {
      await orderService.markPaymentSessionFailed(sessionId, buyerId);
      throw err;
    }

    await orderService.markPaymentSessionProcessed(sessionId, buyerId);
    return res.json({ ok: true, orders: createdOrders });
  } catch (err) {
    try {
      const buyerId = req.user?.userId;
      const sessionId = String(req.body?.sessionId || '').trim();
      if (buyerId && sessionId) {
        await orderService.markPaymentSessionFailed(sessionId, buyerId);
      }
    } catch {
      // ignore best-effort failure mark errors
    }
    console.error('Confirm checkout session error:', err);
    const status =
      err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const message = err instanceof Error ? err.message : 'Failed to confirm checkout session';
    return res.status(status).json({ error: message });
  }
}

module.exports = {
  placeOrder,
  mySellerOrders,
  sellerStats,
  sellerDashboard,
  updateOrderStatus,
  myBuyerOrders,
  createCheckoutSession,
  confirmCheckoutSession,
};
