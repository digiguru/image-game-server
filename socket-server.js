const http = require('http');
const socketio = require('socket.io');
const chat = require('./chat');

/**
 * Build the HTTP + Socket.IO server used by both local development and Vercel.
 * Keeping this in one place prevents production from serving Express routes
 * without also attaching the realtime game protocol.
 */
function createSocketServer(requestListener, options = {}) {
  const {
    origin = process.env.CLIENT_ORIGIN || '*',
    path = '/socket.io',
  } = options;

  const server = http.createServer(requestListener);
  const io = socketio(server, {
    path,
    cors: {
      origin,
      methods: ['GET', 'POST'],
    },
  });

  chat(io);

  return { server, io };
}

module.exports = createSocketServer;
