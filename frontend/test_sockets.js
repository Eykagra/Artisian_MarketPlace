import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000';

async function runTest() {
  try {
    console.log('--- Creating Users ---');
    const sellerMail = `seller_${Date.now()}@test.com`;
    const buyerMail = `buyer_${Date.now()}@test.com`;
    
    // Create Seller
    let res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerMail, password: 'password', role: 'seller' })
    });
    const seller = await res.json();
    
    // Create Buyer
    res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: buyerMail, password: 'password', role: 'buyer' })
    });
    const buyer = await res.json();

    console.log('--- Creating Product ---');
    res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${seller.token}`
      },
      body: JSON.stringify({
        title: 'Test Ceramic Bowl',
        description: 'Handcrafted bowl',
        price: 25.50,
        category: 'Pottery',
        stock: 10
      })
    });
    const product = await res.json();

    console.log('--- Connecting Seller Socket ---');
    const socket = io(API_URL, { auth: { token: seller.token } });
    
    let orderReceived = false;

    socket.on('connect', () => {
      console.log('Seller socket connected! ID:', socket.id);
    });

    socket.on('order:new', (payload) => {
      console.log('\n🔔 SUCCESS! Received real-time event: order:new');
      console.log('Payload:', payload);
      orderReceived = true;
      socket.disconnect();
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error:', err);
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('--- Placing Order as Buyer ---');
    res = await fetch(`${API_URL}/products/${product.id}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyer.token}`
      },
      body: JSON.stringify({
        buyerName: 'John Doe',
        buyerPhone: '1234567890',
        deliveryAddress: '123 Test St',
        deliveryCity: 'Test City',
        deliveryPincode: '12345',
        quantity: 1
      })
    });
    const orderRes = await res.json();
    if (orderRes.error) {
       console.error('Order placement failed:', orderRes.error);
    }

    // Wait for event
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!orderReceived) {
      console.error('\n❌ Failed: Did not receive socket event.');
      process.exit(1);
    } else {
      console.log('\n✅ Real-time notifications are working perfectly!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Test script error:', err);
    process.exit(1);
  }
}

runTest();
