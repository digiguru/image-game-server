const uuidv4 = require('uuid').v4;

const messages = new Set();
let gameState = "lobby";
const users = new Map();
//const prompts = new Map();
const defaultUser = {
  id: 'anon',
  name: 'Anonymous',
};

function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function fakeWaitForServer() {
  return new Promise(resolve => {
    var length = randomIntFromInterval(1000,10000)
    setTimeout(() => {
      console.log("Waited for", length);
      resolve( `did a wait for ${length}`);
    }, length);
  });
}
const messageExpirationTimeMS = 5*60 * 1000;

class Connection {
  constructor(io, socket) {
    console.log('calling');
    //this.asyncCall();
    this.socket = socket;
    this.io = io;
    //Game state
    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.handleSetGameState(state));
    
    //Users
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', (user) => this.handleAddUser(user));
    

    //Prompts
    //socket.on('getPrompts', () => this.getUsers());
    socket.on('addPrompt', (prompt) => this.handleAddPrompt(prompt));
    
    //images
    socket.on('getImages', () => this.getUsers());

    //vote
    socket.on('getVotes', () => this.getVotes());
    socket.on('addVote', (vote) => this.handleAddVote(vote));
    
    //Messages - DELETE
    socket.on('getMessages', () => this.getMessages());
    socket.on('message', (value) => this.handleMessage(value));

    //General
    socket.on('disconnect', () => this.disconnect());
    socket.on('connect_error', (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
  }

  async mockImageAPI() {
    const result = await fakeWaitForServer();
    return result;
  }

  sendMessage(message) {
    this.io.sockets.emit('message', message);
  }
  
  getMessages() {
    messages.forEach((message) => this.sendMessage(message));
  }
  ///Game state
  getGameState() {
    this.io.sockets.emit('gameState', gameState);
  }
  handleSetGameState(value) {
    gameState = value;
    this.getGameState();
  }
  ///Users
  getUsers() {
    this.io.sockets.emit('users', Array.from(users.values()));
  }
  handleAddUser(value) {
    const user = {
      id: uuidv4(),
      value,
      time: Date.now()
    };
    users.set(this.socket.id, user);
    this.getUsers();
  }

  ///Prompt
  getPrompt() {
    //this.io.sockets.emit('users', Array.from(users.values()));
  }
  handleAddPrompt(prompt) {
    console.log(prompt, Array.from(users.keys()), Array.from(users.values()), users)
    var olduser = users.get(this.socket.id);
    if(olduser && prompt && olduser.prompt !== prompt) {
      var user = {...olduser, prompt};
      users.set(this.socket.id, user);
      this.getUsers();  
      this.mockImageAPI().then((result) => {
        console.log("API Called ", result)
      });
    }
  }
  
  handleMessage(value) {
    const message = {
      id: uuidv4(),
      user: users.get(this.socket.id) || defaultUser,
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
    users.delete(this.socket.id);
  }
}

function chat(io) {
  io.on('connection', (socket) => {
    new Connection(io, socket);   
  });
};

module.exports = chat;