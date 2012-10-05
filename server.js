var http = require('http');
var net = require('net');
var sockjs = require('sockjs');

var echo = sockjs.createServer();
echo.on('connection', function(conn) {

    conn.on('data', function(message) {
        message = JSON.parse(message);

        var client = net.connect(message.port, message.host,
          function() { 
            client.write(message.data);
          }
        );

        client.on('data', function(data) {
          conn.write(data.toString());
          // client.end();
        });
        
        client.on('end', function() {
          console.log('client disconnected');
        });
    });
    
    conn.on('close', function() {});

});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/bridge'});
server.listen(9999, '127.0.0.1');