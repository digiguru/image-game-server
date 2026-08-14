const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const createSocketServer = require('../socket-server');

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
