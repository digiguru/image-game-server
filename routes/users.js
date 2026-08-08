const express = require('express');
const router = express.Router();

router.get('/', (_req, res) => {
  res.send('respond with a resource');
});

module.exports = router;
