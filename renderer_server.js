//
// Browser Renderer sample server with multipule rooms/headless browsers
//   https://github.com/mganeko/browser_mcu
//   browser_mcu is provided under MIT license
//
//   This sample is using https://github.com/mganeko/renderer_server
//

// TODO:
//  - use socket.io, use rooms
//  - hold room list, with headless browser object
//  - member index page with socket.io
//  - mcu page with socket.io

'use strict';

const CLOSE_MCU_TIMER_SEC = 5;

const fs = require('fs');

let serverOptions = null;
let mcuOptions = null;
if (isFileExist('options.js')) {
  serverOptions = require('./options').serverOptions;
  mcuOptions = require('./options').mcuOptions;
  console.log('read options.js');
}
else if (isFileExist('options_default.js')) {
  serverOptions = require('./options_default').serverOptions;
  mcuOptions = require('./options_default').mcuOptions;
  console.log('read options_defalult.js');
}
else {
  console.error('NO options. Please set options.js or options_defalult.js');
  process.exit(1);
}

let sslOptions = {};
if (serverOptions.useHttps) {
  sslOptions.key = fs.readFileSync(serverOptions.httpsKeyFile).toString(),
  sslOptions.cert = fs.readFileSync(serverOptions.httpsCertFile).toString()
}

const childProcess = require('child_process');
//let headless = null;


const http = require("http");
const https = require("https");
const WebSocketServer = require('ws').Server;
const express = require('express');

const app = express();
const webPort = serverOptions.listenPort;
app.use(express.static('public_renderer'));

let webServer = null;
if (serverOptions.useHttps) {
  // -- https ---
  webServer = https.createServer( sslOptions, app ).listen(webPort, function(){
    console.log('Web server start. https://' + serverOptions.hostName + ':' + webServer.address().port + '/');
  });
}
else {
  // --- http ---
  webServer = http.Server( app ).listen(webPort, function(){
    console.log('Web server start. http://' + serverOptions.hostName + ':' + webServer.address().port + '/');
  });
}

// --- socket.io server ---
const io = require('socket.io')(webServer);

function getId(socket) {
  return socket.id;
}

function getClientCount() {
  // WARN: undocumented method to get clients number
  return io.eio.clientsCount;
}

function getClientCountInRoom(room) {
  // WARN: undocumented method

  //console.log(io.sockets.manager); // not defined
  //console.log(io);
  //console.log(io.sockets.adapter);
  //console.log(io.sockets.adapter.rooms);
  //console.log(io.sockets.adapter.rooms[room]);
  //console.log(io.sockets.adapter.rooms[room].length);

  let count = 0;  
  if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms) {
    let clients = io.sockets.adapter.rooms[room];
    if (clients) {
      count = clients.length;
    }
    else {
      count = 0;
    }
  }
  else {
    console.log('===ERROR== CANNOT get clients count in room');
  }

  return count;
}


io.on('connection', function(socket) {
  console.log('client connected. socket id=' + getId(socket) + '  , total clients=' + getClientCount());
  //broadcast( { type: 'notify', text: 'new client connected. count=' + getClientCount() } );

  socket.on('disconnect', function() {
    // close user connection
    console.log('client disconnected. socket id=' + getId(socket) + '  , total clients=' + getClientCount());
    //emitMessage('message', { type: 'bye', from: getId(socket)})

    const roomname = getRoomname();
    if (roomname && (roomname !== '')) {
      console.log('-- leave from room=' + roomname);
      socket.leave(roomname);

      if (isMcu()) {
        // MCU shutdown
        console.log('=== MCU disconnected. room=' + roomname);
        resetMcu(roomname);
        emitMessage('message', { type: 'mcu_disconnect', from: getId(socket)})
      }
      else if (isMember()) {
        // member disconnected
        const count = coundDownMembersInRoom(roomname);
        console.log('=== member disconnected. room=' + roomname + ',  count=' + count);
        emitMessage('message', { type: 'client_disconnect', from: getId(socket)})
        
        if (mcuOptions.autoStartHeadless) {
          // -- auto close room, if autoStart --
          if (count <= 0) {
            console.log('set close timer, because no member in room=' + roomname);
            setCloseTimer(roomname);          
          }
        }
      }
      else {
        console.warn(' --- unknown client disconnedted. room=' + roomname);
      }

      //let count = getClientCountInRoom(roomname);
      //if (count < 2) { // WARN! mcu browser is still in the room. Have to count members in the room (except MCU)
      //  console.log('no members in room=' + roomname);
      //  setCloseTimer(roomname);
      //}
    }

    //emitMessage('message', { type: 'client_disconnect', from: getId(socket)})
  });
  socket.on('error',  function(err) {
    console.error('socket ERROR:', err);
  });

  socket.on('enter', function(roomname) {
    //socket.join(roomname);
    console.log('id=' + getId(socket) + ' entering room=' + roomname);
    //setRoomname(roomname);
    clearCloseTimer(roomname);

    // -- check if room / MCU ready
    let count = getClientCountInRoom(roomname);
    if (isRoomReady(roomname)) {
      socket.join(roomname);
      setRoomname(roomname);
      setMember();
      countUpMembersInRoom(roomname);
      console.log('room/MUC is ready. room:' + roomname);
      sendback('welcome', {id: getId(socket), room: roomname, members: count, waitForInvoke: false});
      return;
    }

    // --- room / MCU not ready ---
    if (mcuOptions.autoStartHeadless) {
      // === auto start room and MCU ====
      socket.join(roomname);

      // --- prepare room / MCU
      let ready = prepareRoom(roomname);
      
      if (ready)  {
        setRoomname(roomname);
        setMember();
        countUpMembersInRoom(roomname);
        sendback('welcome', {id: getId(socket), room: roomname, members: count,  waitForInvoke: true});
      }
      else {
        console.error('ERORR: failed to prepare room (invoke MCU');
      }
    }
    else {
      // --- room must be started by MCU , before member enters in ---
      console.log('room/MUC is NOT ready. room:' + roomname);

      // -- not ready ---
      sendback('not_ready', {id: getId(socket), room: roomname});
    }
  });

  socket.on('mcu_enter', function(roomname) {
    //socket.join(roomname);
    console.log('id=' + getId(socket) + ' MCU entering room=' + roomname);
    setRoomname(roomname);
    
    if (isRoomReady(roomname)) {
      console.warn('room / MCU ALREADY ready');
      // -- room / MCU aleady ready, so refuse this
      sendback('already_exist', {id: getId(socket), room: roomname});
    }
    else {
      socket.join(roomname);
      setRoomname(roomname);
      prepareRoomByMcu(roomname);
      setMcu();
      setMcuReady(roomname);
      console.log('room / MCU get ready now');

      let count = getClientCountInRoom(roomname);
      sendback('welcome', {id: getId(socket), room: roomname, members: count});
      emitMessage('message', {type: 'mcu_ready', id: getId(socket), room: roomname});
    }
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  function setMcu() {
    socket.isMcu = true;
  }

  function isMcu() {
    if (socket.isMcu) {
      return true;
    }
    else {
      return false;
    }
  }

  function setMember() {
    socket.isMember = true;
  }

  function isMember() {
    if (socket.isMember) {
      return true;
    }
    else {
      return false;
    }
  }

  // --- emit message to members in the same room --
  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      //console.log('===== message broadcast to room -->' + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    }
    else {
      console.log('===== message broadcast all====');
      socket.broadcast.emit(type, message);
    }
  }

  function sendback(type, message) {
    socket.emit(type, message);
  }

  //function broadast(type, message) {
  //  socket.broadcast.emit(type, message);
  //}

  function sendMessageTo(target, message) {
    socket.to(target).emit('message', message);
  }

  socket.on('message', function incoming(inMessage) {
    const id = getId(socket);
    console.log('received fromId=%s to=%s type=%s',  id, inMessage.to, inMessage.type);
    inMessage.from = id;
 
    let target = inMessage.to;
    if (target) {
      //console.log('===== message emit to -->' + target);
      sendMessageTo(target, inMessage);
    }
    else {
      // broadcast in room
      emitMessage('message', inMessage);
    }
  });
});



//---- rooms ---
let rooms = []; 
var Room = function() {
  let roomname = '';
  let headlessProc = null;
  let mcuReady = false;
  let closeTimer = null;
  let members = 0;
  //let passwordHash = '';
}

function getRoom(name) {
  let room = rooms[name];
  return room;
}

function isRoomExist(name) {
  const room = rooms[name];
  if (room) {
    return true;
  }
  else {
    return false;
  }
}

function setMcuReady(name) {
  let room = getRoom(name);
  if (room) {
    room.mcuReady = true;
  }
}

function resetMcu(name) {
  let room = getRoom(name);
  if (room) {
    room.mcuReady = false;
  }
}

function isRoomReady(name  /*,password*/) {
  let room = getRoom(name);
  if (! room) {
    // not exist yet
    console.log('--room %s not exit', name);
    return false;
  }

  //if (room.headlessProc && room.mcuReady) {
  if (room.mcuReady) {
    console.log('--MCU Ready in room %s', name);
    return true;
  }
  else {
    console.log('--MCU NOT Ready in room %s', name);
    false;
  }
}

function prepareRoom(name  /*, passoword*/) {
  let room = getRoom(name);
  if (! room) {
    console.log('create new room. name=' + name);
    room = new Room();
    room.roomname = name;
    room.members = 0;
    room.mcuReady = false;
    room.headlessProc = null;

    // -- addRoom ---
    rooms[name] = room;
  }
  else {
    console.log('room already exist. name=' + name);
  }
  //console.log('==== room proc=' + room.headlessProc);

  // NOTE:
  // - chiled process will exist when using '--headless' option
  // - without '--headless' option, invokec process will pass to existing browser process and quit soon.
  //
  if (! room.headlessProc) {
    console.log('starting headless browser MCU for room=' + name);
    // -- start headless borowser for mcu --
    room.headlessProc = startHeadlessChrome(name);
    //console.log(' -- after exec room proc=' + room.headlessProc);
    if (! room.headlessProc) {
      console.error('CANNOT start headless MCU');
      return false;
    }
  }
  //console.log('--- prepareRoom end---');

  return true;
}

function prepareRoomByMcu(name  /*, passoword*/) {
  let room = getRoom(name);
  if (! room) {
    console.log('create new room. name=' + name);
    room = new Room();
    room.roomname = name;
    room.members = 0;
    room.mcuReady = true;
    room.headlessProc = null; // not controlling process

    // -- addRoom ---
    rooms[name] = room;
    return true;
  }
  else {
    console.log('room already exist. name=' + name);
    return false;
  }
}

function countUpMembersInRoom(roomname) {
  let room = getRoom(roomname);
  if (room) {
    room.members += 1;
    console.log('countUpMembersInRoom count=' + room.members);
    return room.members;
  }
  else {
    console.warn('room NOT READY: name=' + roomname);
    return -1;
  }
}

function coundDownMembersInRoom(roomname) {
  let room = getRoom(roomname);
  if (room) {
    if (room.members > 0) {
      room.members -= 1;
      console.log('coundDownMembersInRoom count=' + room.members);
    }
    return room.members;
  }
  else {
    console.warn('room NOT READY: name=' + roomname);
    return -1;
  }
}

function handleRoomClose(roomname) {
  let room = getRoom(roomname);
  if (room) {
    room.headlessProc = null;
    room.mcuReady = false;
  }
}

function closeRoom(roomname) {
  console.log('==== closing room === name='+ roomname);
  let room = getRoom(roomname);
  if (room) {
    if(room.headlessProc) {
      stopHeadlessChrome(room.headlessProc);
      room.headlessProc = null;
      room.mcuReady = false;
    }
    delete rooms[roomname];
    room = null;
  }
}

function setCloseTimer(roomname) {
  console.log('--setCloseTimer(%s)--', roomname)
  let room = getRoom(roomname);
  if (room && (! room.closeTimer)) {
    console.log('--set Timeout for close');
    room.closeTimer = setTimeout( (r) => {
       closeRoom(r)
    }, 1000*CLOSE_MCU_TIMER_SEC, roomname);
  }
}

function clearCloseTimer(roomname) {
  let room = getRoom(roomname);
  if (room && room.closeTimer) {
    console.log('-- clearCloseTimer room=' + roomname);
    clearTimeout(room.closeTimer);
    room.closeTimer = null;
  }
}

// --- file check ---
function isFileExist(path) {
  try {
    fs.accessSync(path, fs.constants.R_OK);
    //console.log('File Exist path=' + path);
    return true;
  }
  catch (err) {
    if(err.code === 'ENOENT') {
      //console.log('File NOT Exist path=' + path);
      return false
    }
  }

  console.error('MUST NOT come here');
  return false;
}


// --- headless browser ---

function startHeadlessChrome(roomname) {
  let openURL = buildURL(roomname);
  let mcuArgs = buildArgs(openURL);
  let proc = childProcess.execFile(mcuOptions.headlessFullpath,
    mcuArgs,
    (error, stdout, stderr) => {
      if (error) {
        //console.error('headless chrome ERROR:', error);
        console.error('headless chrome ERROR:');
      }
      else {
        console.log('headless　chrome STDOUT:');
        console.log(stdout);
      }
    }
  );
  console.log('-- start chrome --');
  console.log(' url=' + openURL);

  proc.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    handleRoomClose(roomname);
  });

  return proc;
}

function buildURL(roomname) {
  let protocol = 'http://';
  if (serverOptions.useHttps) {
    protocol = 'https://';
  }

  let url = protocol + serverOptions.hostName + ':' + serverOptions.listenPort + '/' + mcuOptions.headlessUrlRenderer + '?auto=y&room=' + roomname;
  console.log('mcu URL=' + url);
  return url;
}

function buildArgs(url) {
  let args = [].concat(mcuOptions.headlessArgs);
  args.push(url);
  console.log(args);
  return args;
}

function stopHeadlessChrome(proc) {
  if (proc) {
    //proc.kill('SIGKILL'); // OK
    proc.kill('SIGTERM'); // OK
    console.log('---terminate headless chrome ----');
    proc = null;
  }
}

// --- start mcu ---
//startHeadlessChrome();

