/*
  This is a simple TCP echo server for tests.
  Run this server and then open examples/socket_client.html 
  in your browser.
*/

var net = require('net');

var server = net.createServer(function (socket) {
  socket.write("Echo server\r\n");
  socket.pipe(socket);
});

server.listen(1337, "127.0.0.1", function() {
  address = server.address();
  console.log("opened server on %j", address);
});

server.on('connection', function (stream) {
  console.log('New connection ' + stream.remoteAddress);
});
