const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../chat');

class FakeSocket {
  constructor(id) {
    this.id = id;
    this.handlers = new Map();
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  onAny() {
    return this;
  }

  trigger(event, payload) {
    const handler = this.handlers.get(event);
    assert.ok(handler, `expected a handler for ${event}`);
    return handler(payload);
  }
}

function createHarness() {
  const emitted = [];
  let connectHandler;

  const io = {
    sockets: {
      emit(event, payload) {
        emitted.push({ event, payload });
      },
    },
    on(event, handler) {
      if (event === 'connection') {
        connectHandler = handler;
      }
    },
  };

  chat(io);

  function connect(id) {
    assert.ok(connectHandler, 'expected Socket.IO connection handler');
    const socket = new FakeSocket(id);
    connectHandler(socket);
    return socket;
  }

  function latest(event) {
    return emitted.findLast((entry) => entry.event === event)?.payload;
  }

  const firstSocket = connect('socket-reset');
  firstSocket.trigger('reset');
  emitted.length = 0;

  return { connect, emitted, latest };
}

test('game state changes are broadcast to connected clients', () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-host');

  socket.trigger('setGameState', 'voting');

  assert.equal(latest('gameState'), 'voting');
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

test('disconnect removes the logical user rather than the transient socket id', () => {
  const { connect, latest } = createHarness();
  const socket = connect('socket-123');

  socket.trigger('addUser', { name: 'Player', userID: 'player-123' });
  assert.equal(latest('users').length, 1);

  socket.trigger('disconnect');

  assert.deepEqual(latest('users'), []);
});

test('DALL-E responses use the current OpenAI SDK response shape', () => {
  assert.deepEqual(
    chat.extractDalleImage({ data: [{ url: 'https://images.example/result.png' }] }),
    { image: 'https://images.example/result.png' },
  );
  assert.equal(chat.extractDalleImage({ data: [] }), undefined);
});
