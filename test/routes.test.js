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

function request(path, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
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
    req.end();
  });
}

test('GET / serves the game creation dashboard', async () => {
  const response = await request('/');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body, /Image Game Server/);
  assert.match(response.body, /Start new game/);
  assert.match(response.body, /Recent games/);
  assert.match(response.body, /dashboard\.js/);
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

test('POST /room creates a lobby with a unique slug and GET /room lists it', async () => {
  const createdResponse = await request('/room', { method: 'POST' });
  assert.equal(createdResponse.statusCode, 201);
  const created = JSON.parse(createdResponse.body);
  assert.match(created.id, /^[A-F0-9]{8}$/);
  assert.equal(created.state, 'lobby');
  assert.equal(created.playerCount, 0);

  const listResponse = await request('/room');
  assert.equal(listResponse.statusCode, 200);
  const listed = JSON.parse(listResponse.body);
  assert.equal(listed.games.some((game) => game.id === created.id), true);
});

test('GET /room/:slug serves animated detail UI and /data exposes the process-local snapshot', async () => {
  const created = JSON.parse((await request('/room', { method: 'POST' })).body);

  const detailResponse = await request(`/room/${created.id}`);
  assert.equal(detailResponse.statusCode, 200);
  assert.match(detailResponse.headers['content-type'], /^text\/html/);
  assert.match(detailResponse.body, /Game journey/);
  assert.match(detailResponse.body, /Current phase/);
  assert.match(detailResponse.body, /phase-journey/);
  assert.match(detailResponse.body, /Players &amp; images/);
  assert.match(detailResponse.body, /room-detail\.js/);

  const dataResponse = await request(`/room/${created.id}/data`);
  assert.equal(dataResponse.statusCode, 200);
  const snapshot = JSON.parse(dataResponse.body);
  assert.equal(snapshot.id, created.id);
  assert.equal(snapshot.state, 'lobby');
  assert.deepEqual(snapshot.users, []);
});

test('animated detail assets include state transitions and reduced-motion handling', async () => {
  const [scriptResponse, styleResponse] = await Promise.all([
    request('/room-detail.js'),
    request('/stylesheets/style.css'),
  ]);

  assert.equal(scriptResponse.statusCode, 200);
  assert.match(scriptResponse.body, /SNAPSHOT_INTERVAL_MS = 1500/);
  assert.match(scriptResponse.body, /startViewTransition/);
  assert.match(scriptResponse.body, /celebrateResults/);
  assert.match(scriptResponse.body, /phase-step/);

  assert.equal(styleResponse.statusCode, 200);
  assert.match(styleResponse.body, /data-game-state="ideation"/);
  assert.match(styleResponse.body, /@keyframes phase-arrive/);
  assert.match(styleResponse.body, /@keyframes result-burst/);
  assert.match(styleResponse.body, /prefers-reduced-motion: reduce/);
});

test('GET /room rejects unsafe detail ids instead of serving the default room', async () => {
  const response = await request('/room/not%20valid');
  assert.equal(response.statusCode, 400);
});
