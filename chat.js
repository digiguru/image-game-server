const { GameRegistry } = require('./game-session');
const { GameService } = require('./game-service');
const { ImageProviderRegistry } = require('./image-providers');

const defaultRegistry = new GameRegistry();
const defaultProviders = new ImageProviderRegistry();

class Connection {
  constructor(io, socket, { registry, providers }) {
    this.socket = socket;
    this.io = io;
    this.registry = registry;
    this.providers = providers;
    this.roomID = 'default';
    this.userID = null;
    this.socket.join?.(this.roomID);

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
    socket.on('disconnect', () => this.disconnect());
  }

  get game() {
    return this.registry.get(this.roomID);
  }

  get gameService() {
    return new GameService({
      game: this.game,
      providers: this.providers,
      onUsersChanged: () => this.getUsers(),
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
    this.socket.emit?.('protocolError', { message: error.message });
  }

  joinGame(payload = {}) {
    const requestedRoom = typeof payload === 'string' ? payload : payload.roomID;
    const nextGame = this.registry.get(requestedRoom);
    if (this.userID) this.game.removeUser(this.userID);
    this.socket.leave?.(this.roomID);
    this.roomID = nextGame.id;
    this.socket.join?.(this.roomID);
    this.userID = null;
    this.socket.emit?.('joinedGame', { roomID: this.roomID });
    this.getGameState();
    this.getUsers();
  }

  reset() {
    this.game.reset();
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
    this.game.setState(value);
    this.getGameState();
  }

  handleSetGenerator(value) {
    this.game.setGenerator(value);
  }

  getUsers() {
    this.roomEmit('users', this.game.snapshotUsers());
  }

  handleAddUser(payload = {}) {
    const { name, userID } = payload;
    if (this.userID && this.userID !== userID) this.game.removeUser(this.userID);
    this.game.addUser({ name, userID });
    this.userID = userID;
    this.getUsers();
  }

  handleAddPrompt(payload = {}) {
    return this.gameService.addPrompt(payload);
  }

  handleVote(payload = {}) {
    if (this.game.vote(payload)) this.getUsers();
  }

  handleUnvote(payload = {}) {
    if (this.game.unvote(payload)) this.getUsers();
  }

  disconnect() {
    if (!this.userID) return;
    this.game.removeUser(this.userID);
    this.getUsers();
  }
}

function chat(io, { registry = defaultRegistry, providers = defaultProviders } = {}) {
  io.on('connection', (socket) => new Connection(io, socket, { registry, providers }));
}

module.exports = chat;
module.exports.Connection = Connection;
module.exports.defaultRegistry = defaultRegistry;
