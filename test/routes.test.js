const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { version } = require('../package.json');

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

test('GET / serves the image game server landing page', async () => {
  const response = await request('/');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body, /Image Game Server/);
});

test('GET /health exposes useful non-secret service health metadata', async () => {
  const response = await request('/health');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  const health = JSON.parse(response.body);
  assert.equal(health.name, 'image-game-server');
  assert.equal(health.status, 'ok');
  assert.equal(health.version, version);
  assert.equal(Number.isInteger(health.uptimeSeconds), true);
  assert.match(health.timestamp, /^\d{4}-\d{2}-\d{2}T/);
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
