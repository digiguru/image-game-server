const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GameSession,
  GameRegistry,
  createGameID,
  normaliseGameID,
} = require('../game-session');

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

test('new games receive compact unique-looking slugs and appear in registry snapshots', () => {
  const registry = new GameRegistry();
  const first = registry.create();
  const second = registry.create();

  assert.match(first.id, /^[A-F0-9]{8}$/);
  assert.match(second.id, /^[A-F0-9]{8}$/);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(registry.list().map((game) => game.id), [first.id, second.id]);
  assert.equal(registry.list()[0].state, 'lobby');
  assert.equal(registry.list()[0].playerCount, 0);
});

test('game id helpers reject unsafe ids and generate dashboard slugs', () => {
  assert.equal(normaliseGameID(' ROOM_42 '), 'ROOM_42');
  assert.equal(normaliseGameID('../../etc/passwd'), 'default');
  assert.match(createGameID(), /^[A-F0-9]{8}$/);
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

test('session snapshots include player prompt, image and vote detail', () => {
  const game = new GameSession('ROOM42');
  game.addUser({ name: 'Alice', userID: 'alice' });
  game.addUser({ name: 'Bob', userID: 'bob' });
  game.setPrompt({ prompt: 'Moon fox', userID: 'alice' });
  game.updateImageData({ image: 'https://example.com/fox.png' }, 'alice');
  game.vote({ votedBy: 'bob', votedFor: 'alice' });

  const snapshot = game.snapshot();
  assert.equal(snapshot.id, 'ROOM42');
  assert.equal(snapshot.playerCount, 2);
  assert.equal(snapshot.users[0].prompt, 'Moon fox');
  assert.equal(snapshot.users[0].image, 'https://example.com/fox.png');
  assert.deepEqual(snapshot.users[0].votes, ['bob']);
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
