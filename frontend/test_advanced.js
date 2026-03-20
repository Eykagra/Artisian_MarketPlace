import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000';

async function runAdvancedTests() {
  console.log('=== Starting Advanced Real-Time Validation ===\n');

  try {
    const sellerMail = `seller_adv_${Date.now()}@test.com`;
    let res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerMail, password: 'password', role: 'seller' })
    });
    const seller = await res.json();

    // 1. Failure Scenario: Invalid JWT Connection
    console.log('[Test 1] Failure Scenario: Invalid JWT Handshake');
    const badSocket = io(API_URL, { auth: { token: 'invalid.jwt.token' } });
    
    let badSocketConnected = false;
    let authErrorCaught = false;

    badSocket.on('connect', () => { badSocketConnected = true; });
    badSocket.on('connect_error', (err) => {
      if (err.message.includes('Authentication error')) authErrorCaught = true;
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    if (badSocketConnected || !authErrorCaught) {
      throw new Error('Test 1 Failed: Unauthenticated socket was allowed to connect or did not return explicit Auth Error.');
    }
    console.log('✅ Test 1 Passed: Invalid token correctly rejected by server middleware.\n');
    badSocket.disconnect();

    // 2. Multi-Connection Testing (Multiple Devices/Tabs for same user)
    console.log('[Test 2] Multi-Connection Testing (Rooms)');
    const socketTab1 = io(API_URL, { auth: { token: seller.token } });
    const socketTab2 = io(API_URL, { auth: { token: seller.token } });

    let tab1Received = false;
    let tab2Received = false;

    socketTab1.on('order:new', () => { tab1Received = true; });
    socketTab2.on('order:new', () => { tab2Received = true; });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate placing an order to trigger the event for this seller
    console.log('   -> Simulating order placement to trigger event...');
    res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${seller.token}` },
      body: JSON.stringify({ title: 'Test', description: 'desc', price: 10, category: 'Test', stock: 10 })
    });
    const product = await res.json();

    const buyerRes = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `buyer_adv_${Date.now()}@test.com`, password: 'password', role: 'buyer' })
    });
    const buyer = await buyerRes.json();

    await fetch(`${API_URL}/products/${product.id}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${buyer.token}` },
      body: JSON.stringify({ buyerName: 'John', buyerPhone: '123', deliveryAddress: 'A', deliveryCity: 'B', deliveryPincode: 'C', quantity: 1 })
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!tab1Received || !tab2Received) {
      throw new Error(`Test 2 Failed: Broadcasting failed. Tab 1: ${tab1Received}, Tab 2: ${tab2Received}`);
    }
    console.log('✅ Test 2 Passed: Event successfully broadcasted to ALL active sessions (multiple tabs) for the targeted user.\n');
    
    socketTab1.disconnect();
    socketTab2.disconnect();

    console.log('=== All Advanced Tests Passed! ===\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ADVANCED TEST SUITE FAILED:', err.message || err);
    process.exit(1);
  }
}

runAdvancedTests();
