// Socket client
function Socket(webtcp, host, port, options) {
    this.sID = Math.random().toString(36).substr(2); 
    this.webtcp = webtcp;
    this.ready = false;
    this.closed = false;
    this.options = options;
    this.sockOpts = { _updating: false }

    this.remoteAddress = host;
    this.remotePort = port;

    this.webtcp.sockets[this.sID] = this;

    this.createPacket = function() {
      return {
        sID: this.sID,
        type: "tcp",
        options: this.options,
        host: this.remoteAddress,
        port: this.remotePort,
        data: null
      }
    }

   this.onconnect = function() {
     this.webtcp.sockets[sID].ready = true;
     this.webtcp.sockets[sID].closed = false;
   }

   this.ondata = function(){}
   this.onend = function(){}
   this.ontimeout = function(){}
   this.ondrain = function(){}

   this.onclose = function() {
     this.webtcp.sockets[sID].ready = false;
     this.webtcp.sockets[sID].closed = true;
   }

   this.onSockOptsRcv = function(opts) {
     this.sockOpts = opts;
     this.sockOpts['_updating'] = false;
   };

   this.getSockOpts = function(callback) {
     this.sockOpts._updating = true;
     this.rpc("getSockOpts");
   };

}

Socket.prototype = new WebTCPAPI();