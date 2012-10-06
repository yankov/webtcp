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

  this.client = net.connect(this.remotePort, this.remoteAddress,
    (function(that) { return function() { 
       that.respond("CONNECTED"); 
    }})(this)
  )

  this.respond = function(data) {
    pck = this.packet;
    pck.data = data;

    this.sockjsConn.write(pck);    
  }

  // when message comes from real socket
  // redirect it to a browser client
  this.client.on('data', function(data) {
    respond( data.toString() );
  });

  // when message comes from a browser client 
  this.onClientData = function(data) {
    if (data == "CLOSE") {
      // this.client.end();
    }
    else {
      this.client.write(data.data);
    }
  }
  
  // this.client.on('end', function() {
  //   console.log('client disconnected');
  // });

}

var echo = sockjs.createServer();
var websockets = {};

echo.on('connection', function(conn) {

    conn.on('data', function(message) {
        message = JSON.parse(message);

        if (websockets[message.s_id]) {
          websockets[message.s_id].onClientData(message);
        }
        else {
          socket = new Socket(conn, message.s_id, message.host, message.port);
          websockets[message.s_id] = socket;
          socket.onClientData(message);
        }
      
    });
    
    conn.on('close', function() {});

});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/bridge'});
server.listen(9999, '127.0.0.1');