const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function run() {
  try {
    const signupRes = await axios.post('http://localhost:5000/auth/signup', {
      email: `seller_up_${Date.now()}@test.com`,
      password: 'password', role: 'seller'
    });
    const token = signupRes.data.token;

    const dummy = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA636460600000000600021E63604C0000000049454E44AE426082', 'hex');
    fs.writeFileSync('dummy.png', dummy);

    const form = new FormData();
    form.append('image', fs.createReadStream('dummy.png'));

    const res = await axios.post('http://localhost:5000/upload/image', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` }
    });
    console.log("Success:", res.data);
  } catch(err) {
    console.error("EXACT ERROR:", err.response?.data || err.message);
  }
}
run();
