const uuidv4 = require('uuid').v4;

const messages = new Set();
const gameState = "lobby";
const users = new Map();

const defaultUser = {
  id: 'anon',
  name: 'Anonymous',
};

const messageExpirationTimeMS = 5*60 * 1000;

class Connection {
  constructor(io, socket) {
    this.socket = socket;
    this.io = io;
    //Game state
    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.handleSetGameState(state));
    
    //Users
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', (user) => this.handleAddUser(user));
    

    //Prompts
    socket.on('getPrompts', () => this.getUsers());
    socket.on('addPrompt', (prompt) => this.handleAddPrompt(prompt));
    
    //images
    socket.on('getImages', () => this.getUsers());
     
    
    //Messages - DELETE
    socket.on('getMessages', () => this.getMessages());
    socket.on('message', (value) => this.handleMessage(value));

    //General
    socket.on('disconnect', () => this.disconnect());
    socket.on('connect_error', (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
  }
  
  sendMessage(message) {
    this.io.sockets.emit('message', message);
  }
  
  getMessages() {
    messages.forEach((message) => this.sendMessage(message));
  }

  getGameState() {
    this.io.sockets.emit('gameState', gameState);
  }
  handleSetGameState(value) {
    gameState = value;
    this.getGameState();
  }
  handleMessage(value) {
    const message = {
      id: uuidv4(),
      user: users.get(this.socket) || defaultUser,
      value,
      time: Date.now()
    };

    messages.add(message);
    this.sendMessage(message);

    setTimeout(
      () => {
        messages.delete(message);
        this.io.sockets.emit('deleteMessage', message.id);
      },
      messageExpirationTimeMS,
    );
  }

  disconnect() {
    users.delete(this.socket);
  }
}

function chat(io) {
  io.on('connection', (socket) => {
    new Connection(io, socket);   
  });
};

module.exports = chat;