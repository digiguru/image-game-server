const test = require('node:test');
const assert = require('node:assert/strict');
const { GameSession, GameRegistry } = require('../game-session');

test('sessions isolate state and players', () => {
  const registry = new GameRegistry();
  const alpha = registry.get('alpha');
  const beta = registry.get('beta');

  alpha.setState('voting');
  alpha.addUser({ name: 'Alice', userID: 'alice' });

  assert.equal(alpha.state, 'voting');
  assert.equal(beta.state, 'lobby');
  assert.equal(alpha.snapshotUsers().length, 1);
  assert.equal(beta.snapshotUsers().length, 0);
});

test('invalid states and generators are rejected', () => {
  const game = new GameSession('test');

  assert.throws(() => game.setState('banana'), /Invalid game state/);
  assert.throws(() => game.setGenerator('Dream Studio'), /Invalid image generator/);
});

test('player and prompt payloads are validated', () => {
  const game = new GameSession('test');

  assert.throws(() => game.addUser({ name: '', userID: 'x' }), /Player name/);
  game.addUser({ name: ' Alice ', userID: 'alice' });
  assert.equal(game.snapshotUsers()[0].name, 'Alice');
  assert.throws(() => game.setPrompt({ prompt: '', userID: 'alice' }), /Prompt/);
  assert.throws(() => game.setPrompt({ prompt: 'hello', userID: 'missing' }), /Unknown player/);
});

test('votes require real players and cannot target yourself', () => {
  const game = new GameSession('test');
  game.addUser({ name: 'Alice', userID: 'alice' });
  game.addUser({ name: 'Bob', userID: 'bob' });

  assert.equal(game.vote({ votedBy: 'alice', votedFor: 'alice' }), false);
  assert.equal(game.vote({ votedBy: 'missing', votedFor: 'bob' }), false);
  assert.equal(game.vote({ votedBy: 'alice', votedFor: 'bob' }), true);
  assert.equal(game.vote({ votedBy: 'alice', votedFor: 'bob' }), false);
  assert.deepEqual(game.snapshotUsers().find((user) => user.userID === 'bob').votes, ['alice']);
});

test('removing a player also removes their votes', () => {
  const game = new GameSession('test');
  game.addUser({ name: 'Alice', userID: 'alice' });
  game.addUser({ name: 'Bob', userID: 'bob' });
  game.vote({ votedBy: 'alice', votedFor: 'bob' });

  game.removeUser('alice');

  assert.deepEqual(game.snapshotUsers().find((user) => user.userID === 'bob').votes, []);
});
