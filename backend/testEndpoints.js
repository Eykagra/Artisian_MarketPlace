// Simple script to test backend endpoints
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function get(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  console.log(`\n[GET ${path}] Status: ${res.status}`);
  console.log('Body:', text);
  return { status: res.status, body: text };
}

async function post(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`\n[POST ${path}] Status: ${res.status}`);
  console.log('Body:', text);
  return { status: res.status, body: text };
}

async function main() {
  try {
    await get('/health');
    await get('/db-health');
    await get('/products');
    await post('/auth/signup', { email: 'verify@example.com', password: 'pass123' });
    await post('/auth/login', { email: 'verify@example.com', password: 'pass123' });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();

