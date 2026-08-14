const createSocketServer = require('../socket-server');

// Vercel mounts this function at /api/socket-io. Socket.IO then handles its
// normal /socket.io path beneath that mount, giving clients the public path
// /api/socket-io/socket.io.
const { server } = createSocketServer();

module.exports = server;
