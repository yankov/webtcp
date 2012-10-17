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
