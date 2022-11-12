//const Horde = require('./Horde');
const Horde = require('./Horde');
const uuidv4 = require('uuid').v4;


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
    socket.on('addUser', ({name, userID}) => this.handleAddUser({name, userID}));
    socket.on('getUserID', () => this.getUserID());
    

    //Prompts
    //socket.on('getPrompts', () => this.getUsers());
    socket.on('addPrompt', ({prompt, userID}) => this.handleAddPrompt({prompt, userID}));
    
    //images
    socket.on('updateImages', () => this.updateImages());

    //vote
    socket.on('getVotes', () => this.getVotes());
    socket.on('addVote', (vote) => this.handleAddVote(vote));
    
    

    //General
    socket.on('disconnect', () => this.disconnect());
    socket.on('connect_error', (err) => {
      console.log(`connect_error due to ${err.message}`);
    });
    socket.onAny((event, ...args) => {
      console.log(event, args);
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
        console.log("Image", u.imageid);
        if(!u.image) {
          horde.checkImage(u.imageid).then(function(output) {
            console.log("SECOND",output);
            if(output.done === true) {
              return {image: output.generations[0].img}
            }
            return;
          }).then((l) => this.updateImageData(l, key))  
        }
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
  getUserID() {
    this.io.sockets.emit('userID', Array.from(users.values()));
  }
  handleAddUser({name, userID}) {
    console.log("handleAddUser", name, userID)
    const user = {
      userID,
      name,
      time: Date.now()
    };
    users.set(userID, user);
    //this.io.sockets.emit('userid', user.id));
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
  handleAddPrompt({prompt, userID}) {
    console.log(prompt, Array.from(users.keys()), Array.from(users.values()), users)
    var olduser = users.get(userID);

    if(olduser && prompt && olduser.prompt !== prompt) {
      var promptedUser = {...olduser, prompt};
      users.set(userID, promptedUser);
      this.getUsers(); 
      console.log("Gen image:"); 
      this.generateImage(prompt).then((x) => {
        console.log("GENED image - now update", x)
        this.updateImageData(x,userID);
      });
    }
  }
  
 

  disconnect() { //TODO; NOT SURE THIS CAN WORK
    users.delete(this.socket.id);
  }
}

function chat(io) {
  io.on('connection', (socket) => {
    new Connection(io, socket);   
  });
};

module.exports = chat;