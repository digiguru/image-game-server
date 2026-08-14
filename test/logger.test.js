const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger } = require('../logger');

test('logger emits structured JSON with scope and details', () => {
  const lines = [];
  const logger = createLogger('test', {
    log: (line) => lines.push(line),
    error: (line) => lines.push(line),
  });

  logger.info('game_state_changed', { roomID: 'ROOM1', state: 'voting' });

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'info');
  assert.equal(entry.scope, 'test');
  assert.equal(entry.event, 'game_state_changed');
  assert.equal(entry.roomID, 'ROOM1');
  assert.equal(entry.state, 'voting');
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('logger omits undefined details and routes errors to the error sink', () => {
  const logs = [];
  const errors = [];
  const logger = createLogger('test', {
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
  });

  logger.error('provider_failed', { roomID: 'ROOM1', userID: undefined, error: 'boom' });

  assert.equal(logs.length, 0);
  assert.equal(errors.length, 1);
  const entry = JSON.parse(errors[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.error, 'boom');
  assert.equal('userID' in entry, false);
});
