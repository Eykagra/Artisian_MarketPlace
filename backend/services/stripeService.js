const Stripe = require('stripe');

let stripeClient = null;

function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

async function createCheckoutSession({ lineItems, metadata }) {
  const stripe = getStripe();
  const frontendUrl = getFrontendUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: `${frontendUrl}/cart?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/cart?checkout=cancel`,
    metadata,
  });
  return session;
}

async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

async function refundPaymentIntent(paymentIntentId) {
  const stripe = getStripe();
  if (!paymentIntentId) return null;
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
  });
}

module.exports = { createCheckoutSession, retrieveCheckoutSession, refundPaymentIntent };

