var http = require('http');
var net = require('net');
var sockjs = require('sockjs');

var Socket = function(sockjsConn, remoteSocketId, host, port) {
  var EVENTS = ["connect", "data", "end", "close", "timeout", "drain", "error"]

  this.sockjsConn = sockjsConn;
  this.remoteSocketId = remoteSocketId;
  this.remoteAddress = host;
  this.remotePort = port;

  this.packet = {
    sID: this.remoteSocketId,
    eventName: null,
    data: null
  }

  this.client = net.connect(this.remotePort, this.remoteAddress);

  this.mapEvent = function(eventName) {
    this.client.on(eventName, (function(that) { return function(data){
      if(data) data = data.toString();
      that.emitSockEvent(eventName, data); 

      // also delete socket object if one of these events happened
      if (["end", "close", "timeout"].indexOf(eventName) != -1) 
        delete websockets[that.remoteSocketId];

    }})(this));
  }

  //map sock events to client's sock events
  this.mapEvents = function(events) {
    for(i in events) 
      this.mapEvent.call(this, events[i]);
  }

  this.mapEvents.call(this, EVENTS);

  // trigger a socket's event on a client side
  this.emitSockEvent = function(eventName, data) {
    pck = this.packet;
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }

  // when message comes from a browser client 
  // write it to socket
  this.onClientData = (function(that) { return function(data) {
      that.client.write(data.data);
    }})(this);

}

var echo = sockjs.createServer();
var websockets = {};

echo.on('connection', function(conn) {

    conn.on('data', function(message) {
        message = JSON.parse(message);

        if (websockets[message.sID]) {
          websockets[message.sID].onClientData(message);
        }
        else {
          socket = new Socket(conn, message.sID, message.host, message.port);
          websockets[message.sID] = socket;
          socket.onClientData(message);
        }
      
    });
    
    conn.on('close', function() {});
});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/bridge'});
server.listen(9999, '127.0.0.1');