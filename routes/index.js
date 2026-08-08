const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ name: 'image-game-server', status: 'ok' });
});

module.exports = router;
