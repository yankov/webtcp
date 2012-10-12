var http = require('http');
var net = require('net');
var sockjs = require('sockjs');
var Socket = require('server/socket.js').Socket;
var httpClient = require('server/httpClient.js').httpClient;

var echo = sockjs.createServer();
var websockets = {};
var httpClients = {};

echo.on('connection', function(conn) {

  conn.on('data', function(message) {
    message = JSON.parse(message);

    if (message.type == "tcp") {
      // create socket binding if it doesn't exist
      if (!websockets[message.sID]) 
        websockets[message.sID] = new Socket(conn, message.sID, message.host, message.port, message.options);

      websockets[message.sID].onClientData(message);

    } else if (message.type == "http") {
      
      if (!httpClients[message.cID]) 
        httpClients[message.cID] = new httpClient(conn, message.cID)

      httpClients[message.cID].onClientData(message);
    }
  });
  
  conn.on('close', function() {});
});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/bridge'});
server.listen(9999, '127.0.0.1');