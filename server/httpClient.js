var http = require('http');

module.exports.httpClient = function(sockjsConn, cID) {
  var EVENTS = ["connect", "data", "end", "close", "upgrade", "continue"];

  this.sockjsConn = sockjsConn;
  this.cID = cID;

  this.createPacket = function() { 
    return {
      cID: this.cID,
      eventName: null,
      data: null
    }
  }

  // how to refactor this?
  this.get = function(data){
    http.get(data, (function(that, data) {
      return function(res) {
        res.setEncoding(data.encoding || 'utf8');

        res.on('data', (function(that) {
          return function(data) {
            that.emitClientEvent("data", data);    
          }
        }(that)));        
        
    }}(this, data))).on('error', (function(that) { 
      return function(e) {
        that.emitClientEvent("data", {error: e});    
    }}(this)));
  }

  this.onClientData = (function(that) { return function(data) {
      if (data.command && data.command == "httpGet") {
        that.get.call(that, data.args);
      } else if (data.command && data.command == "httpPost") {
        that.post.call(that, data);  
      }
    }})(this);


  // trigger a socket's event on a client side
  this.emitClientEvent = function(eventName, data) {
    var pck = this.createPacket();
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }
}
