var net = require('net');
var http = require('http');

module.exports.httpClient = function(sockjsConn, cID) {
  var EVENTS = ["connect", "data", "end", "close", "upgrade", "continue"];

  this.sockjsConn = sockjsConn;
  this.cID = cID;
  var self = this;

  this.createPacket = function() { 
    return {
      cID: this.cID,
      eventName: null,
      data: null
    }
  }

  // how to refactor this?
  this.get = function(data){
    var _data = data;

    http.get(data, function(res) {
      res.setEncoding(_data.encoding || 'utf8');

      res.on('data', function(data) {
        self.emitClientEvent("data", data);    
      });        
        
    }).on('error', function(e) {
      self.emitClientEvent("data", {error: e});    
    });
  }

  this.onClientData = function(data) {
    if (data.command && data.command == "httpGet") {
      this.get(data.args);
    } else if (data.command && data.command == "httpPost") {
      this.post(data);  
    }
  };


  // trigger a socket's event on a client side
  this.emitClientEvent = function(eventName, data) {
    var pck = this.createPacket();
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }
}
