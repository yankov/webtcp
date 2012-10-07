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
    srcHost: this.remoteAddress,
    srcPort: this.remotePort,
    data: null
  }

  this.client = net.connect(this.remotePort, this.remoteAddress);

  this.client.on('connect', (function(that) { return function() { 
       // that.emitSockEvent("connect"); 
    }})(this));

  this.respond = function(data) {
    pck = this.packet;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );    
  }

  // trigger a socket's event on a client side
  this.emitSockEvent = function(eventName, data) {
    pck = this.packet;
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }

  // when message comes from real socket
  // redirect it to a browser client
  this.client.on('data', (function(that) { 
    return function(data) {
      that.emitSockEvent('data', data.toString() );
    }
  })(this));

  // notify browser about closed socket
  this.client.on('end', (function(that) { 
    return function(data) {
      that.emitSockEvent("close"); 
      delete websockets[that.remoteSocketId];
    }
  })(this));

  //handle errors
  this.client.on('error', (function(that) { 
    return function(data) {
      that.emitSockEvent('error', data);
    }
  })(this));

  // when message comes from a browser client 
  // write it to socket
  this.onClientData = (function(that) { return function(data) {
      if (data == "CLOSE") {
        // this.client.end();
      }
      else {
        that.client.write(data.data);
      }
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
          try {
            console.log('inside');
            socket = new Socket(conn, message.sID, message.host, message.port);
            websockets[message.sID] = socket;
            socket.onClientData(message);
          } catch(e) {
            console.log('in catch');
            conn.write(JSON.stringify({sID:message.sID, data: "cannot connect tho"}));
          }
        }
      
    });
    
    conn.on('close', function() {});

});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/bridge'});
server.listen(9999, '127.0.0.1');