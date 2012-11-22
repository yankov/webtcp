// HTTP client that sits on a WebTCP server side, makes GET or POST
// requests if asked by a client and sends response back to a client 

var net = require('net');
var http = require('http');
var clientEvents = require('./client_events.js').clientEvents;

module.exports.httpClient = function(sockjsConn, cID) {
  var EVENTS = ["connect", "data", "end", "close", "upgrade", "continue"];

  // sockjs connection (shared across all http clients)
  this.sockjsConn = sockjsConn;

  // remove http client id
  this.cID = cID;
  var self = this;

  // envelope for packets that are sent to sockjs connection
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

  this.httpPost = function(options, params){
    var _options = options;
    params = JSON.stringify(params);

    _options.method = "POST";
    _options.headers = _options.headers || {};
    _options.headers['Content-Length'] = params.length;

    var req = http.request(_options, function(res) {
      res.setEncoding(_options.encoding || 'utf8');

      res.on('data', function(data) {
        self.emitClientEvent("data", data);    
      });        
    
    });

    req.write( JSON.stringify(params) );
    req.end();

    req.on('error', function(e) {
      self.emitClientEvent("data", {error: e});    
    });
  }
}

module.exports.httpClient.prototype = new clientEvents();