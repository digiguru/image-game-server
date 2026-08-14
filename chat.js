const Dalle = require('./dalle');
const Horde = require('./horde');

let gameState = 'lobby';
let generator = 'Dall-e';
let users = new Map();
let horde = new Horde();
let dalle = new Dalle();

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function fakeWaitForServer() {
  return new Promise((resolve) => {
    const length = randomIntFromInterval(250, 1000);
    setTimeout(() => {
      console.log('Waited for', length);
      resolve(`did a wait for ${length}`);
    }, length);
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
    this.userID = null;

    socket.on('reset', () => this.reset());

    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.handleSetGameState(state));

    socket.on('setGenerator', (value) => this.handleSetGenerator(value));

    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', ({ name, userID }) => this.handleAddUser({ name, userID }));

    socket.on('addPrompt', ({ prompt, userID }) => this.handleAddPrompt({ prompt, userID }));

    socket.on('updateImages', () => this.updateImages());

    socket.on('vote', ({ votedBy, votedFor }) => this.handleVote({ votedBy, votedFor }));
    socket.on('unvote', ({ votedBy, votedFor }) => this.handleUnvote({ votedBy, votedFor }));

    socket.on('disconnect', () => this.disconnect());
    socket.on('connect_error', (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
    socket.onAny((event, ...args) => {
      console.log(event, args);
    });
  }

  debug = (...args) => {
    console.log(args);
    this.io.sockets.emit('debug', { debug: args, time: Date.now() });
  };

  reset = () => {
    gameState = 'lobby';
    generator = 'Stable Horde';
    users = new Map();
    horde = new Horde();
    dalle = new Dalle();
    this.getGameState();
    this.getUsers();
    this.io.sockets.emit('reset-clients');
  };

  async updateImages() {
    this.debug('UPDATE ALL IMAGES', users.keys());

    for (const key of users.keys()) {
      const user = users.get(key);
      this.debug('ROW', user);

      if (generator === 'Mock') {
        const image = await fakeWaitForServer().then(() => this.mockImage());
        this.updateImageData(image, key);
        continue;
      }

      if (generator === 'Stable Horde') {
        if (!user.image && user.imageid) {
          try {
            const output = await horde.checkImage(user.imageid);
            this.debug('CheckImage', output);
            if (output && output.done === true && output.generations?.[0]?.img) {
              this.updateImageData({ image: output.generations[0].img }, key);
            }
          } catch (err) {
            this.debug('CheckImageErr', err);
          }
        }
        continue;
      }

      this.debug('GENERATOR NOT SUPPORTED', generator);
    }
  }

  mockImage = () => {
    console.log('Creating mock image');
    return { image: 'https://placehold.co/512x512?text=Mock+Image' };
  };

  async generateImage(prompt) {
    if (generator === 'Mock') {
      await fakeWaitForServer();
      return this.mockImage();
    }

    if (generator === 'Stable Horde') {
      try {
        const output = await horde.promiseImage(prompt);
        this.debug('FIRST', output);
        return output?.id ? { imageid: output.id } : undefined;
      } catch (err) {
        this.debug('promiseImageErr', err);
        return undefined;
      }
    }

    if (generator === 'Dall-e') {
      try {
        const output = await dalle.promiseImage(prompt);
        this.debug('DALLE Output', output?.data);
        return extractDalleImage(output);
      } catch (err) {
        this.debug('dalle promiseImageErr', err);
        return undefined;
      }
    }

    this.debug('GENERATOR NOT SUPPORTED', generator);
    return undefined;
  }

  getGameState() {
    this.io.sockets.emit('gameState', gameState);
  }

  handleSetGameState(value) {
    gameState = value;
    this.getGameState();
  }

  handleSetGenerator(value) {
    generator = value;
  }

  getUsers() {
    const output = Array.from(users.values()).map((user) => ({
      ...user,
      votes: Array.from(user.votes.values()),
    }));
    this.io.sockets.emit('users', output);
  }

  handleAddUser({ name, userID }) {
    if (this.userID && this.userID !== userID) {
      users.delete(this.userID);
    }

    this.userID = userID;
    const user = {
      userID,
      name,
      time: Date.now(),
      votes: new Set(),
    };
    users.set(userID, user);
    this.getUsers();
  }

  updateImageData(object, userID) {
    const promptedUser = users.get(userID);
    if (!object || !promptedUser) {
      return;
    }

    if (object.image) {
      users.set(userID, { ...promptedUser, image: object.image });
      this.getUsers();
      return;
    }

    if (object.imageid) {
      users.set(userID, { ...promptedUser, imageid: object.imageid });
      this.getUsers();
    }
  }

  handleAddPrompt({ prompt, userID }) {
    const oldUser = users.get(userID);

    if (oldUser && prompt && oldUser.prompt !== prompt) {
      users.set(userID, { ...oldUser, prompt });
      this.getUsers();
      this.generateImage(prompt).then((imageData) => {
        this.updateImageData(imageData, userID);
      });
    }
  }

  handleVote({ votedBy, votedFor }) {
    const oldUser = users.get(votedFor);
    if (oldUser && votedBy && votedFor && !oldUser.votes.has(votedBy)) {
      oldUser.votes.add(votedBy);
      users.set(votedFor, oldUser);
      this.getUsers();
    }
  }

  handleUnvote({ votedBy, votedFor }) {
    const oldUser = users.get(votedFor);
    if (oldUser && votedBy && votedFor && oldUser.votes.has(votedBy)) {
      oldUser.votes.delete(votedBy);
      users.set(votedFor, oldUser);
      this.getUsers();
    }
  }

  disconnect() {
    if (this.userID) {
      users.delete(this.userID);
      this.getUsers();
    }
  }
}

function chat(io) {
  io.on('connection', (socket) => {
    new Connection(io, socket);
  });
}

module.exports = chat;
module.exports.extractDalleImage = extractDalleImage;
