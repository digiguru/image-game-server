const Dalle = require('./dalle');
const Horde = require('./horde');
const { GameRegistry } = require('./game-session');

const registry = new GameRegistry();
const horde = new Horde();
const dalle = new Dalle();

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function fakeWaitForServer() {
  return new Promise((resolve) => {
    const length = randomIntFromInterval(250, 1000);
    setTimeout(resolve, length);
  });
}

function extractDalleImage(output) {
  const image = output?.data?.[0]?.url;
  return image ? { image } : undefined;
}

class Connection {
  constructor(io, socket) {
    this.socket = socket;
    this.io = io;
    this.roomID = 'default';
    this.userID = null;
    this.socket.join?.(this.roomID);

    socket.on('joinGame', (payload) => this.joinGame(payload));
    socket.on('reset', () => this.safe(() => this.reset()));
    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.safe(() => this.handleSetGameState(state)));
    socket.on('setGenerator', (value) => this.safe(() => this.handleSetGenerator(value)));
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', (payload) => this.safe(() => this.handleAddUser(payload)));
    socket.on('addPrompt', (payload) => this.safe(() => this.handleAddPrompt(payload)));
    socket.on('updateImages', () => this.updateImages());
    socket.on('vote', (payload) => this.safe(() => this.handleVote(payload)));
    socket.on('unvote', (payload) => this.safe(() => this.handleUnvote(payload)));
    socket.on('disconnect', () => this.disconnect());
  }

  get game() {
    return registry.get(this.roomID);
  }

  roomEmit(event, payload) {
    if (this.io.to) this.io.to(this.roomID).emit(event, payload);
    else this.io.sockets.emit(event, payload);
  }

  safe(action) {
    try {
      return action();
    } catch (error) {
      this.socket.emit?.('protocolError', { message: error.message });
      return undefined;
    }
  }

  joinGame(payload = {}) {
    const requestedRoom = typeof payload === 'string' ? payload : payload.roomID;
    const nextGame = registry.get(requestedRoom);
    if (this.userID) this.game.removeUser(this.userID);
    this.socket.leave?.(this.roomID);
    this.roomID = nextGame.id;
    this.socket.join?.(this.roomID);
    this.userID = null;
    this.socket.emit?.('joinedGame', { roomID: this.roomID });
    this.getGameState();
    this.getUsers();
  }

  debug(...args) {
    console.log(`[game:${this.roomID}]`, ...args);
  }

  reset() {
    this.game.reset();
    this.getGameState();
    this.getUsers();
    this.roomEmit('reset-clients');
  }

  async updateImages() {
    for (const user of this.game.users.values()) {
      if (this.game.generator === 'Mock') {
        await fakeWaitForServer();
        this.updateImageData(this.mockImage(), user.userID);
      } else if (this.game.generator === 'Stable Horde' && !user.image && user.imageid) {
        try {
          const output = await horde.checkImage(user.imageid);
          if (output?.done === true && output.generations?.[0]?.img) {
            this.updateImageData({ image: output.generations[0].img }, user.userID);
          }
        } catch (error) {
          this.debug('Stable Horde image check failed', error.message);
        }
      }
    }
  }

  mockImage() {
    return { image: 'https://placehold.co/512x512?text=Mock+Image' };
  }

  async generateImage(prompt) {
    if (this.game.generator === 'Mock') {
      await fakeWaitForServer();
      return this.mockImage();
    }

    if (this.game.generator === 'Stable Horde') {
      try {
        const output = await horde.promiseImage(prompt);
        return output?.id ? { imageid: output.id } : undefined;
      } catch (error) {
        this.debug('Stable Horde generation failed', error.message);
        return undefined;
      }
    }

    if (this.game.generator === 'Dall-e') {
      try {
        return extractDalleImage(await dalle.promiseImage(prompt));
      } catch (error) {
        this.debug('DALL-E generation failed', error.message);
        return undefined;
      }
    }

    return undefined;
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

  updateImageData(data, userID) {
    if (this.game.updateImageData(data, userID)) this.getUsers();
  }

  handleAddPrompt(payload = {}) {
    const { prompt, userID } = payload;
    if (!this.game.setPrompt({ prompt, userID })) return;
    this.getUsers();
    this.generateImage(prompt).then((imageData) => this.updateImageData(imageData, userID));
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

function chat(io) {
  io.on('connection', (socket) => new Connection(io, socket));
}

module.exports = chat;
module.exports.extractDalleImage = extractDalleImage;
module.exports.registry = registry;
