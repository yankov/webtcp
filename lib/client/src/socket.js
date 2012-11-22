// Socket client
// creates socket object which allows to send data to a real socket
// through webtcp (sockjs) tunnel

function Socket(webtcp, host, port, options) {
    // client's socket id
    this.sID = Math.random().toString(36).substr(2); 

    // sockjs connection (shared across all socket objects)
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
        id: Math.random().toString(36).substr(2),
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

   // some hooks that can be used for additional event handling
   // this will not be overwritten by client event handlers
   this.ondata = function(){}
   this.onend = function(){}
   this.ontimeout = function(){}
   this.ondrain = function(){}

   this.onclose = function() {
     this.webtcp.sockets[sID].ready = false;
     this.webtcp.sockets[sID].closed = true;
   }

   // Update socket options. onSockOptsRcv will be 
   // triggered when data is received. 
   // to get updated data:
   //   socket.getSockOpts();
   //   socket.sockOpts;
   this.getSockOpts = function(callback) {
     this.sockOpts._updating = true;
     this.rpc("getSockOpts");
   };

   this.onSockOptsRcv = function(opts) {
     this.sockOpts = opts;
     this.sockOpts['_updating'] = false;
   };

}

// inherit some common functions to interract with Webtcp tunnel
Socket.prototype = new WebTCPIO();