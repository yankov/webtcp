// HTTP client
var Http = function(webtcp) {
  this.cID = Math.random().toString(36).substr(2); 
  this.webtcp = webtcp;

  this.webtcp.httpClients[this.cID] = this;

  this.createPacket = function() {
    return {
      cID: this.cID,
      type: "http",
      host: this.remoteAddress,
      port: this.remotePort,
      method: null,
      data: null
    }
  }

 this.ondata = function(data) { }

 this.get = function(options, callback) {
   this.on('data', callback);
   this.rpc("httpGet", options);
 }
 
}

Http.prototype = new WebTCPAPI();
