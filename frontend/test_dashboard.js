const API_URL = 'http://localhost:5000';
async function test() {
  const sellerMail = `seller_dash_${Date.now()}@test.com`;
  let res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: sellerMail, password: 'password', role: 'seller' })
  });
  const seller = await res.json();

  res = await fetch(`${API_URL}/seller/dashboard`, {
    headers: { 'Authorization': `Bearer ${seller.token}` }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  console.log('✅ Empty Dashboard State Success:');
  console.log(JSON.stringify(data, null, 2));
  
  // Create product and order to test populated state
  res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${seller.token}` },
    body: JSON.stringify({ title: 'Test Product', description: 'desc', price: 100, category: 'Jewelry', stock: 10 })
  });
  const product = await res.json();

  const buyerRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `buyer_dash_${Date.now()}@test.com`, password: 'password', role: 'buyer' })
  });
  const buyer = await buyerRes.json();

  await fetch(`${API_URL}/products/${product.id}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${buyer.token}` },
    body: JSON.stringify({ buyerName: 'John', buyerPhone: '123', deliveryAddress: 'A', deliveryCity: 'B', deliveryPincode: 'C', quantity: 2 })
  });

  res = await fetch(`${API_URL}/seller/dashboard`, {
    headers: { 'Authorization': `Bearer ${seller.token}` }
  });
  const popData = await res.json();
  console.log('\n✅ Populated Dashboard State Success:');
  console.log(JSON.stringify(popData.summary, null, 2));
  if (popData.summary.totalRevenue === 200 && popData.summary.totalOrders === 1) {
    console.log('\n✅ SQL Aggregations are completely accurate!');
    process.exit(0);
  } else {
    throw new Error('Aggregation logic failed.');
  }
}
test().catch(e => { console.error(e); process.exit(1); });
