const { GameRegistry } = require('./game-session');
const { GameService } = require('./game-service');
const { ImageProviderRegistry } = require('./image-providers');
const { createLogger } = require('./logger');

const defaultRegistry = new GameRegistry();
const defaultProviders = new ImageProviderRegistry();
const defaultLogger = createLogger('socket');

class Connection {
  constructor(io, socket, { registry, providers, logger }) {
    this.socket = socket;
    this.io = io;
    this.registry = registry;
    this.providers = providers;
    this.logger = logger;
    this.roomID = 'default';
    this.userID = null;
    this.socket.join?.(this.roomID);

    this.logger.info('socket_connected', { socketID: socket.id, roomID: this.roomID });

    socket.on('joinGame', (payload) => this.safe(() => this.joinGame(payload)));
    socket.on('reset', () => this.safe(() => this.reset()));
    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.safe(() => this.handleSetGameState(state)));
    socket.on('setGenerator', (value) => this.safe(() => this.handleSetGenerator(value)));
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', (payload) => this.safe(() => this.handleAddUser(payload)));
    socket.on('addPrompt', (payload) => this.safe(() => this.handleAddPrompt(payload)));
    socket.on('updateImages', () => this.safe(() => this.updateImages()));
    socket.on('vote', (payload) => this.safe(() => this.handleVote(payload)));
    socket.on('unvote', (payload) => this.safe(() => this.handleUnvote(payload)));
    socket.on('disconnect', (reason) => this.disconnect(reason));
  }

  get game() {
    return this.registry.get(this.roomID);
  }

  get gameService() {
    return new GameService({
      game: this.game,
      providers: this.providers,
      onUsersChanged: () => this.getUsers(),
      logger: this.logger,
    });
  }

  roomEmit(event, payload) {
    if (this.io.to) this.io.to(this.roomID).emit(event, payload);
    else this.io.sockets.emit(event, payload);
  }

  safe(action) {
    try {
      const result = action();
      if (result && typeof result.catch === 'function') {
        return result.catch((error) => this.emitProtocolError(error));
      }
      return result;
    } catch (error) {
      this.emitProtocolError(error);
      return undefined;
    }
  }

  emitProtocolError(error) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn('protocol_rejected', {
      roomID: this.roomID,
      userID: this.userID || undefined,
      socketID: this.socket.id,
      error: message,
    });
    this.socket.emit?.('protocolError', { message });
  }

  joinGame(payload = {}) {
    const requestedRoom = typeof payload === 'string' ? payload : payload.roomID;
    const previousRoomID = this.roomID;
    const nextGame = this.registry.get(requestedRoom);
    if (this.userID) this.game.removeUser(this.userID);
    this.socket.leave?.(this.roomID);
    this.roomID = nextGame.id;
    this.socket.join?.(this.roomID);
    this.userID = null;
    this.logger.info('room_joined', {
      socketID: this.socket.id,
      previousRoomID,
      roomID: this.roomID,
    });
    this.socket.emit?.('joinedGame', { roomID: this.roomID });
    this.getGameState();
    this.getUsers();
  }

  reset() {
    this.game.reset();
    this.logger.info('game_reset', { roomID: this.roomID });
    this.getGameState();
    this.getUsers();
    this.roomEmit('reset-clients');
  }

  updateImages() {
    return this.gameService.refreshImages();
  }

  getGameState() {
    this.roomEmit('gameState', this.game.state);
  }

  handleSetGameState(value) {
    const previousState = this.game.state;
    this.game.setState(value);
    this.logger.info('game_state_changed', {
      roomID: this.roomID,
      previousState,
      state: this.game.state,
    });
    this.getGameState();
  }

  handleSetGenerator(value) {
    const previousGenerator = this.game.generator;
    this.game.setGenerator(value);
    this.logger.info('generator_changed', {
      roomID: this.roomID,
      previousGenerator,
      generator: this.game.generator,
    });
  }

  getUsers() {
    this.roomEmit('users', this.game.snapshotUsers());
  }

  handleAddUser(payload = {}) {
    const { name, userID } = payload;
    if (this.userID && this.userID !== userID) this.game.removeUser(this.userID);
    this.game.addUser({ name, userID });
    this.userID = userID;
    this.logger.info('player_joined', {
      roomID: this.roomID,
      userID,
      playerCount: this.game.users.size,
    });
    this.getUsers();
  }

  handleAddPrompt(payload = {}) {
    this.logger.info('prompt_submitted', {
      roomID: this.roomID,
      userID: payload.userID,
      generator: this.game.generator,
    });
    return this.gameService.addPrompt(payload);
  }

  handleVote(payload = {}) {
    if (this.game.vote(payload)) {
      this.logger.info('vote_recorded', {
        roomID: this.roomID,
        votedBy: payload.votedBy,
        votedFor: payload.votedFor,
      });
      this.getUsers();
    }
  }

  handleUnvote(payload = {}) {
    if (this.game.unvote(payload)) {
      this.logger.info('vote_removed', {
        roomID: this.roomID,
        votedBy: payload.votedBy,
        votedFor: payload.votedFor,
      });
      this.getUsers();
    }
  }

  disconnect(reason) {
    this.logger.info('socket_disconnected', {
      socketID: this.socket.id,
      roomID: this.roomID,
      userID: this.userID || undefined,
      reason,
    });
    if (!this.userID) return;
    this.game.removeUser(this.userID);
    this.getUsers();
  }
}

function chat(
  io,
  { registry = defaultRegistry, providers = defaultProviders, logger = defaultLogger } = {},
) {
  io.on('connection', (socket) => new Connection(io, socket, { registry, providers, logger }));
}

module.exports = chat;
module.exports.Connection = Connection;
module.exports.defaultRegistry = defaultRegistry;
