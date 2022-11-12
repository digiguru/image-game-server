//const Horde = require('./Horde');
const Horde = require('./Horde');
const uuidv4 = require('uuid').v4;

const messages = new Set();
let gameState = "lobby";
let generator = "Mock";
const users = new Map();
const horde = new Horde();
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
    var length = randomIntFromInterval(250,1000)
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
    
    //Generator
    socket.on('setGenerator', (generator) => this.handleSetGenerator(generator));

    //Users
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', (user) => this.handleAddUser(user));
    

    //Prompts
    //socket.on('getPrompts', () => this.getUsers());
    socket.on('addPrompt', (prompt) => this.handleAddPrompt(prompt));
    
    //images
    socket.on('updateImages', () => this.updateImages());

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
  async updateImages() {
    console.log("UPDATE ALL IMAGES");
    Array.from(users.keys()).forEach(key => {
      let u = users.get(key);
      console.log("ROW", u);
      if(generator === 'Mock') {
        fakeWaitForServer().then(this.mockImage);
      } else if (generator === 'Stable Horde') {
        console.log("Image", u.imageid)
        horde.checkImage(u.imageid).then(function(output) {
          console.log("SECOND",output);
          if(output.done === true) {
            return {image: output.generations[0].img}
          }
          return;
        }).then((l) => this.updateImageData(l, key))
      } else {//if(generator === 'Mock') {
        console.log('GENERATOR NOT SUPPORTED', generator);
      }
    })
   
  }
  mockImage = () => {
    console.log("Creating mock image")
    return {image: "http://placekitten.com/g/512/512"}
  }
  async generateImage(prompt) {
    if(generator === 'Mock') {
      return await fakeWaitForServer().then(() => {
        return this.mockImage()
      });
    } else if (generator === 'Stable Horde') {
      return await horde.promiseImage(prompt).then(function(output) {
        console.log("FIRST",output);
        return {imageid: output.id};
      })
    } else {//if(generator === 'Mock') {
      console.log('GENERATOR NOT SUPPORTED', generator);
    }
/*
Dream Studio
Dall-e
*/

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
  handleSetGenerator(value) {
    generator = value;
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

  updateImageData(object, userid) {
    console.log("updateImageData", object, userid)
    var promptedUser = users.get(userid);
    if(object) {
      if(object.image) {
        let image = object.image;
        var imagedUser = {...promptedUser, image};
        console.log("API Called with image output", imagedUser)
        users.set(userid, imagedUser);
        this.getUsers();
      } else if (object.imageid) {
        let imageid = object.imageid;
        var awaitingImageUser = {...promptedUser, imageid};
        console.log("API Called with awaiting image output", imagedUser)
        users.set(userid, awaitingImageUser);
        this.getUsers();
      }
    }

    
  }
  ///Prompt
  handleAddPrompt(prompt) {
    console.log(prompt, Array.from(users.keys()), Array.from(users.values()), users)
    var socketID = this.socket.id;
    var olduser = users.get(this.socket.id);

    if(olduser && prompt && olduser.prompt !== prompt) {
      var promptedUser = {...olduser, prompt};
      users.set(socketID, promptedUser);
      this.getUsers(); 
      console.log("Gen image:"); 
      this.generateImage(prompt).then((x) => {
        console.log("GENED image - now update", x)
        this.updateImageData(x,socketID);
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