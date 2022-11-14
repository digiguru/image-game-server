const Horde = require('./horde');
const uuidv4 = require('uuid').v4;

let gameState = "lobby";
let generator = "Stable Horde";
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


    socket.on('reset', () => this.reset());
    

    //Game state
    socket.on('getGameState', () => this.getGameState());
    socket.on('setGameState', (state) => this.handleSetGameState(state));
    
    //Generator
    socket.on('setGenerator', (generator) => this.handleSetGenerator(generator));

    //Users
    socket.on('getUsers', () => this.getUsers());
    socket.on('addUser', ({name, userID}) => this.handleAddUser({name, userID}));
   
    

    //Prompts
    //socket.on('getPrompts', () => this.getUsers());
    socket.on('addPrompt', ({prompt, userID}) => this.handleAddPrompt({prompt, userID}));
    
    //images
    socket.on('updateImages', () => this.updateImages());

    //vote
    socket.on('vote', ({votedBy,votedFor}) => this.handleVote({votedBy,votedFor}));
    socket.on('unvote', ({votedBy,votedFor}) => this.handleUnvote({votedBy,votedFor}));
    
    

    //General
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
    this.io.sockets.emit('debug', {debug: {...args}, time: Date.now()});
  }
  reset = () => {
    gameState = "lobby";
    generator = "Stable Horde";
    users = new Map();
    horde = new Horde();
    this.getUsers();
    this.io.sockets.emit('reset-clients', output);
  }
  async updateImages() {
    this.debug("UPDATE ALL IMAGES", users.keys());
    let debugMe = this.debug;
    Array.from(users.keys()).forEach(key => {
      
      let u = users.get(key);
      debugMe("ROW", u);
      if(generator === 'Mock') {
        fakeWaitForServer().then(this.mockImage);
      } else if (generator === 'Stable Horde') {
        debugMe("StableImage", u.imageid);
        if(!u.image) {
          horde.checkImage(u.imageid).catch((err) => {
            debugMe("CheckImageErr",err, process.env.HORDE_TOKEN);
          }).then(function(output) {
            debugMe("CheckImage",output);
            if(output.done === true) {
              return {image: output.generations[0].img}
            }
            return;
          }).then((l) => this.updateImageData(l, key))  
        }
      } else {//if(generator === 'Mock') {
        debugMe('GENERATOR NOT SUPPORTED', generator);
      }
    })
   
  }
  mockImage = () => {
    console.log("Creating mock image")
    return {image: "http://placekitten.com/g/512/512"}
  }
  async generateImage(prompt) {
    let debugMe = this.debug;
    if(generator === 'Mock') {
      return await fakeWaitForServer().then(() => {
        return this.mockImage()
      });
    } else if (generator === 'Stable Horde') {
      return await horde.promiseImage(prompt).catch((err) => {
        debugMe("promiseImageErr",err, process.env.HORDE_TOKEN);
      }).then(function(output) {
        debugMe("FIRST",output);
        return {imageid: output.id};
      })
    } else {//if(generator === 'Mock') {
      debugMe('GENERATOR NOT SUPPORTED', generator);
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
    console.log("USERS", users.values());
    let output = Array.from(users.values()).map(user => {
      return {...user, ...{votes: Array.from(user.votes.values())}}
    });
    this.io.sockets.emit('users', output);
  }

  handleAddUser({name, userID}) {
    console.log("handleAddUser", name, userID)
    const user = {
      userID,
      name,
      time: Date.now(),
      votes: new Set()
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

  handleVote({votedBy,votedFor}) {
    var olduser = users.get(votedFor);
    console.log("VOTE", votedBy, votedFor, olduser, olduser.votes);
    if(olduser && votedBy && votedFor && !olduser.votes.has(votedBy)) {
      olduser.votes.add(votedBy);
      users.set(votedFor, olduser);
      this.getUsers();
    }
  }

  handleUnvote({votedBy,votedFor}) {
    var olduser = users.get(votedFor);
    console.log("UNVOTE", votedBy, votedFor, olduser, olduser.votes);
    if(olduser && votedBy && votedFor && olduser.votes.has(votedBy)) {
      olduser.votes.delete(votedBy);
      users.set(votedFor, olduser);
      this.getUsers();
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