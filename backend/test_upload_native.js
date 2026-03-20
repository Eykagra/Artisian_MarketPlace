const fs = require('fs');
async function run() {
  try {
    const signupRes = await fetch('http://localhost:5000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `seller_native_${Date.now()}@test.com`, password: 'password', role: 'seller' })
    });
    const seller = await signupRes.json();
    const token = seller.token;

    const dummy = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA636460600000000600021E63604C0000000049454E44AE426082', 'hex');
    
    const form = new FormData();
    form.append('image', new Blob([dummy], { type: 'image/png' }), 'dummy.png');

    const res = await fetch('http://localhost:5000/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Payload:", data);
  } catch(err) {
    console.error("ERROR:", err);
  }
}
run();
