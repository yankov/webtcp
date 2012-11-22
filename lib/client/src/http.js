// HTTP client that works with WebTCP server
// sends GET and POST requests through webtcp tunnel (sockjs)
// Check out example of using it in examples/http_client.html

function Http(webtcp) {
  // http client id
  this.cID = Math.random().toString(36).substr(2); 

  // sockjs connection (shared across all http client objects and socket objects)
  this.webtcp = webtcp;

  // add yourself to a list of known clients
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

 // send GET request and assign a client's callback
 this.get = function(options, callback) {
   this.on('data', callback);
   this.rpc("httpGet", [options]);
 }

 // send POST request and assign a client's callback
 this.post = function(options, params, callback) {
   this.on('data', callback);
   this.rpc("httpPost", [options, params]);
 }
 
}

// inherit some common functions to interract with Webtcp tunnel
Http.prototype = new WebTCPIO();
