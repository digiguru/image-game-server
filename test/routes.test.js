const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');

let server;
let port;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      },
    );
    req.on('error', reject);
  });
}

test('GET / exposes a health response', async () => {
  const response = await request('/');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.deepEqual(JSON.parse(response.body), {
    name: 'image-game-server',
    status: 'ok',
  });
});

test('GET /users responds successfully', async () => {
  const response = await request('/users');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'respond with a resource');
});

test('GET /room responds successfully', async () => {
  const response = await request('/room');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'respond with a resource');
});
