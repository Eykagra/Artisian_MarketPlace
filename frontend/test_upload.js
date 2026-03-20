const fs = require('fs');
const path = require('path');

async function test() {
  const API_URL = 'http://localhost:5000';
  
  // 1. Get a seller token
  const sellerMail = `seller_upload_${Date.now()}@test.com`;
  let res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: sellerMail, password: 'password', role: 'seller' })
  });
  const seller = await res.json();
  if (!seller.token) throw new Error("No token");

  // 2. Create a dummy image
  const dummyPath = path.join(__dirname, 'dummy.png');
  fs.writeFileSync(dummyPath, Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA636460600000000600021E63604C0000000049454E44AE426082', 'hex'));

  // 3. Upload exactly how the browser would, using raw Fetch
  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', fs.createReadStream(dummyPath));

  try {
    const uploadRes = await fetch(`${API_URL}/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seller.token}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    const text = await uploadRes.text();
    console.log("Status:", uploadRes.status);
    console.log("Response:", text);
    
    if (uploadRes.status === 400) {
      console.log("THIS IS THE ERROR!");
    }
  } catch(err) {
    console.error("Fetch failed", err);
  }
}
test().catch(console.error);
