const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const createSocketServer = require('../socket-server');

function createMessageQueue(socket) {
  const messages = [];
  const waiters = [];

  socket.addEventListener('message', (event) => {
    const message = String(event.data);
    const waiter = waiters.shift();
    if (waiter) {
      waiter(message);
    } else {
      messages.push(message);
    }
  });

  return function nextMessage() {
    if (messages.length > 0) {
      return Promise.resolve(messages.shift());
    }

    return new Promise((resolve) => waiters.push(resolve));
  };
}

async function nextApplicationPacket(socket, nextMessage) {
  let packet = await nextMessage();

  while (packet === '2') {
    socket.send('3');
    packet = await nextMessage();
  }

  return packet;
}

async function assertGameStateOverWebSocket(path) {
  const { server, io } = createSocketServer(undefined, { path });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const socket = new globalThis.WebSocket(
    `ws://127.0.0.1:${address.port}${path}/?EIO=4&transport=websocket`,
  );
  const nextMessage = createMessageQueue(socket);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), { once: true });
  });

  const engineHandshake = await nextApplicationPacket(socket, nextMessage);
  assert.match(engineHandshake, /^0/);

  socket.send('40');
  const namespaceHandshake = await nextApplicationPacket(socket, nextMessage);
  assert.match(namespaceHandshake, /^40/);

  socket.send('42["getGameState"]');
  const gameState = await nextApplicationPacket(socket, nextMessage);
  assert.equal(gameState, '42["gameState","lobby"]');

  socket.close();
  await new Promise((resolve) => io.close(resolve));
}

test('shared server factory attaches Socket.IO to an HTTP server', () => {
  const { server, io } = createSocketServer();

  assert.ok(server instanceof http.Server);
  assert.ok(server.listeners('upgrade').length > 0);
  assert.equal(io.of('/').listenerCount('connection'), 1);

  io.close();
});

test('Vercel Socket.IO entry point exports an upgrade-capable HTTP server', () => {
  const server = require('../api/socket-io');

  assert.ok(server instanceof http.Server);
  assert.ok(server.listeners('upgrade').length > 0);
});

test('realtime game state works over the local WebSocket transport', { timeout: 5000 }, async () => {
  await assertGameStateOverWebSocket('/socket.io');
});

test('realtime game state works on the Vercel function route', { timeout: 5000 }, async () => {
  await assertGameStateOverWebSocket('/api/socket-io');
});
