const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { defaultRegistry } = require('../chat');
const { normaliseGameID } = require('../game-session');

const router = express.Router();
const publicRoot = path.resolve(__dirname, '..', 'public');
const roomHtml = fs.readFileSync(path.join(publicRoot, 'room.html'), 'utf8');
const ROOM_PAGE_WINDOW_MS = 60 * 1000;
const ROOM_PAGE_LIMIT = 120;
const roomPageRequests = new Map();

function rateLimitRoomPage(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const existing = roomPageRequests.get(key);
  const current = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + ROOM_PAGE_WINDOW_MS };

  current.count += 1;
  roomPageRequests.set(key, current);

  res.setHeader('RateLimit-Limit', String(ROOM_PAGE_LIMIT));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, ROOM_PAGE_LIMIT - current.count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

  if (current.count > ROOM_PAGE_LIMIT) {
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
    return res.status(429).send('Too many requests');
  }

  return next();
}

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

router.get('/:roomID', rateLimitRoomPage, (req, res) => {
  const roomID = normaliseGameID(req.params.roomID);
  if (roomID === 'default' && req.params.roomID !== 'default') {
    return res.status(400).send('Invalid game id');
  }
  return res.type('html').send(roomHtml);
});

module.exports = router;
