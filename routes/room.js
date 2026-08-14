const express = require('express');
const path = require('node:path');
const { defaultRegistry } = require('../chat');
const { normaliseGameID } = require('../game-session');

const router = express.Router();
const publicRoot = path.resolve(__dirname, '..', 'public');

router.get('/', (_req, res) => {
  res.json({ games: defaultRegistry.list() });
});

router.post('/', (_req, res) => {
  const game = defaultRegistry.create();
  res.status(201).json(game.snapshot());
});

router.get('/:roomID/data', (req, res) => {
  const roomID = normaliseGameID(req.params.roomID);
  const game = defaultRegistry.get(roomID);
  res.json(game.snapshot());
});

router.get('/:roomID', (req, res) => {
  const roomID = normaliseGameID(req.params.roomID);
  if (roomID === 'default' && req.params.roomID !== 'default') {
    return res.status(400).send('Invalid game id');
  }
  return res.sendFile('room.html', { root: publicRoot });
});

module.exports = router;
