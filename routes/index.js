const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ name: 'image-game-server', status: 'ok' });
});

module.exports = router;
