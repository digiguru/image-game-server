const createSocketServer = require('../socket-server');

// Vercel exposes this file at /api/socket-io. Mount Socket.IO on that exact
// route rather than relying on an additional nested /socket.io path, which
// Vercel does not route to this function automatically.
const { server } = createSocketServer(undefined, {
  path: '/api/socket-io',
});

module.exports = server;
