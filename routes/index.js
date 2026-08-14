const express = require('express');
const { version } = require('../package.json');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    name: 'image-game-server',
    status: 'ok',
    version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
