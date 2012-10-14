var http = require('http');
var sockjs = require('sockjs');
var Socket = require('./socket.js').Socket;
var httpClient = require('./httpClient.js').httpClient;

module.exports.WebTCP = function() {
  this.sockjsServer = sockjs.createServer();
  this.websockets = {};
  this.httpClients = {};

  var self = this;

  this.sockjsServer.on('connection', function(conn) {
    conn.on('data', function(message) {
      self.dispatch(conn, message);
    });
  });

  // client's message processor
  // TODO: dry out
  this.dispatch = function(conn, message) {
    message = JSON.parse(message);

    if (message.type == "tcp") {
      // create socket binding if it doesn't exist
      if (!this.websockets[message.sID]) 
        this.websockets[message.sID] = new Socket(conn, message.sID, message.host, message.port, message.options);

      this.websockets[message.sID].onClientData(message);

    } else if (message.type == "http") {
        
      if (!this.httpClients[message.cID]) 
        this.httpClients[message.cID] = new httpClient(conn, message.cID)

      this.httpClients[message.cID].onClientData(message);
    }
  }

  this.listen = function(port, host) {
    this.server = http.createServer();
    this.sockjsServer.installHandlers(this.server, { prefix: '/bridge' });
    this.server.listen(port, host);
  }
  
}