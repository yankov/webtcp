var net = require('net');
var http = require('http');
var clientEvents = require('./client_events.js').clientEvents;

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

  this.httpGet = function(data){
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

}

module.exports.httpClient.prototype = new clientEvents();
