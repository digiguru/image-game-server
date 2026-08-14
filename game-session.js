const VALID_STATES = new Set(['lobby', 'ideation', 'voting', 'results']);
const VALID_GENERATORS = new Set(['Mock', 'Stable Horde', 'Dall-e']);

class GameSession {
  constructor(id) {
    this.id = id;
    this.reset();
  }

  reset() {
    this.state = 'lobby';
    this.generator = 'Dall-e';
    this.users = new Map();
  }

  setState(state) {
    if (!VALID_STATES.has(state)) {
      throw new Error(`Invalid game state: ${state}`);
    }
    this.state = state;
  }

  setGenerator(generator) {
    if (!VALID_GENERATORS.has(generator)) {
      throw new Error(`Invalid image generator: ${generator}`);
    }
    this.generator = generator;
  }

  addUser({ name, userID }) {
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      throw new Error('Player name must be between 1 and 60 characters');
    }
    if (typeof userID !== 'string' || !userID || userID.length > 100) {
      throw new Error('Invalid player id');
    }

    this.users.set(userID, {
      userID,
      name: name.trim(),
      time: Date.now(),
      votes: new Set(),
    });
  }

  removeUser(userID) {
    if (!userID) return;
    this.users.delete(userID);
    for (const user of this.users.values()) {
      user.votes.delete(userID);
    }
  }

  setPrompt({ prompt, userID }) {
    const user = this.users.get(userID);
    if (!user) throw new Error('Unknown player');
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 1000) {
      throw new Error('Prompt must be between 1 and 1000 characters');
    }
    if (user.prompt === prompt.trim()) return false;
    this.users.set(userID, { ...user, prompt: prompt.trim() });
    return true;
  }

  updateImageData(data, userID) {
    const user = this.users.get(userID);
    if (!user || !data) return false;
    if (data.image) this.users.set(userID, { ...user, image: data.image });
    else if (data.imageid) this.users.set(userID, { ...user, imageid: data.imageid });
    else return false;
    return true;
  }

  vote({ votedBy, votedFor }) {
    const target = this.users.get(votedFor);
    if (!target || !this.users.has(votedBy) || votedBy === votedFor) return false;
    if (target.votes.has(votedBy)) return false;
    target.votes.add(votedBy);
    return true;
  }

  unvote({ votedBy, votedFor }) {
    const target = this.users.get(votedFor);
    if (!target || !target.votes.has(votedBy)) return false;
    target.votes.delete(votedBy);
    return true;
  }

  snapshotUsers() {
    return Array.from(this.users.values()).map((user) => ({
      ...user,
      votes: Array.from(user.votes),
    }));
  }
}

class GameRegistry {
  constructor() {
    this.games = new Map();
  }

  get(id = 'default') {
    const roomID = typeof id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(id) ? id : 'default';
    if (!this.games.has(roomID)) this.games.set(roomID, new GameSession(roomID));
    return this.games.get(roomID);
  }
}

module.exports = { GameSession, GameRegistry, VALID_STATES, VALID_GENERATORS };
