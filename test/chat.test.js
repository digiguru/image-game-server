const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../chat');
const { GameRegistry } = require('../game-session');

class FakeSocket {
  constructor(id) {
    this.id = id;
    this.handlers = new Map();
    this.directEmitted = [];
    this.rooms = new Set();
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event, payload) {
    this.directEmitted.push({ event, payload });
  }

  join(roomID) {
    this.rooms.add(roomID);
  }

  leave(roomID) {
    this.rooms.delete(roomID);
  }

  trigger(event, payload) {
    const handler = this.handlers.get(event);
    assert.ok(handler, `expected a handler for ${event}`);
    return handler(payload);
  }

  latestDirect(event) {
    return this.directEmitted.findLast((entry) => entry.event === event)?.payload;
  }
}

function createHarness() {
  const emitted = [];
  let connectHandler;
  const immediateProvider = {
    async generate() { return { image: 'mock-image' }; },
    async refresh() { return undefined; },
  };

  const io = {
    sockets: {
      emit(event, payload) {
        emitted.push({ roomID: '*', event, payload });
      },
    },
    to(roomID) {
      return {
        emit(event, payload) {
          emitted.push({ roomID, event, payload });
        },
      };
    },
    on(event, handler) {
      if (event === 'connection') connectHandler = handler;
    },
  };

  chat(io, {
    registry: new GameRegistry(),
    providers: { get: () => immediateProvider },
  });

  function connect(id) {
    assert.ok(connectHandler, 'expected Socket.IO connection handler');
    const socket = new FakeSocket(id);
    connectHandler(socket);
    return socket;
  }

  function latest(event, roomID = 'default') {
    return emitted.findLast((entry) => entry.event === event && entry.roomID === roomID)?.payload;
  }

  return { connect, emitted, latest };
}

test('game state changes are broadcast to the current room', () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-host');

  socket.trigger('setGameState', 'voting');

  assert.equal(latest('gameState'), 'voting');
});

test('invalid game state is rejected as a protocol error', () => {
  const { connect } = createHarness();
  const socket = connect('socket-host');

  socket.trigger('setGameState', 'banana');

  assert.match(socket.latestDirect('protocolError').message, /Invalid game state/);
});

test('reset returns the room to lobby and clears players', () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-host');

  socket.trigger('addUser', { name: 'Host', userID: 'host' });
  socket.trigger('setGameState', 'results');
  socket.trigger('reset');

  assert.equal(latest('gameState'), 'lobby');
  assert.deepEqual(latest('users'), []);
});

test('users can join, vote and unvote', () => {
  const { connect, latest } = createHarness();
  const alice = connect('socket-alice');
  const bob = connect('socket-bob');

  alice.trigger('addUser', { name: 'Alice', userID: 'alice' });
  bob.trigger('addUser', { name: 'Bob', userID: 'bob' });
  alice.trigger('vote', { votedBy: 'alice', votedFor: 'bob' });

  let users = latest('users');
  assert.deepEqual(users.find((user) => user.userID === 'bob').votes, ['alice']);

  alice.trigger('unvote', { votedBy: 'alice', votedFor: 'bob' });
  users = latest('users');
  assert.deepEqual(users.find((user) => user.userID === 'bob').votes, []);
});

test('prompt generation is delegated and resulting image is broadcast', async () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-player');
  socket.trigger('addUser', { name: 'Alice', userID: 'alice' });
  socket.trigger('setGenerator', 'Mock');

  await socket.trigger('addPrompt', { prompt: 'a fox astronaut', userID: 'alice' });

  const alice = latest('users').find((user) => user.userID === 'alice');
  assert.equal(alice.prompt, 'a fox astronaut');
  assert.equal(alice.image, 'mock-image');
});

test('disconnect removes the logical user rather than the transient socket id', () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-123');

  socket.trigger('addUser', { name: 'Player', userID: 'player-123' });
  assert.equal(latest('users').length, 1);

  socket.trigger('disconnect');

  assert.deepEqual(latest('users'), []);
});

test('separate game rooms do not receive each other state changes', () => {
  const { connect, emitted } = createHarness();
  const alpha = connect('socket-alpha');
  const beta = connect('socket-beta');

  alpha.trigger('joinGame', { roomID: 'alpha' });
  beta.trigger('joinGame', { roomID: 'beta' });
  emitted.length = 0;

  alpha.trigger('setGameState', 'ideation');

  assert.equal(emitted.some((entry) => entry.roomID === 'alpha' && entry.event === 'gameState' && entry.payload === 'ideation'), true);
  assert.equal(emitted.some((entry) => entry.roomID === 'beta' && entry.event === 'gameState'), false);
});
