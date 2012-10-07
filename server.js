var http = require('http');
var net = require('net');
var sockjs = require('sockjs');

var Socket = function(sockjsConn, remoteSocketId, host, port) {
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

  this.client.on('connect', (function(that) { return function() { 
    that.emitSockEvent("connect"); 
  }})(this));

  // when message comes from real socket
  // redirect it to a browser client
  this.client.on('data', (function(that) { 
    return function(data) {
      that.emitSockEvent('data', data.toString() );
    }
  })(this));

  // socket closed by remote side
  this.client.on('end', (function(that) { 
    return function(data) {
      that.emitSockEvent("end"); 
      delete websockets[that.remoteSocketId];
    }
  })(this));

  // emitted when socket is fully closed
  this.client.on('close', (function(that) { 
    return function(data) {
      that.emitSockEvent("close"); 
      delete websockets[that.remoteSocketId];
    }
  })(this));

  // emitted when socket times out from inactivity
  this.client.on('timeout', (function(that) { 
    return function(data) {
      that.emitSockEvent("timeout"); 
      delete websockets[that.remoteSocketId];
    }
  })(this));

// emitted when the write buffer becomes empty. Can be used to throttle uploads.
  this.client.on('drain', (function(that) { 
    return function(data) {
      that.emitSockEvent("drain"); 
    }
  })(this));

  //handle errors
  this.client.on('error', (function(that) { 
    return function(data) {
      that.emitSockEvent('error', data);
    }
  })(this));

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