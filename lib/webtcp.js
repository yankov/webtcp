var WebTCP = function(host, port) {
   var BUFF_SIZE = 10;

   this.sockets = {};
   this.httpClients = {};
   this.sock = new SockJS("http://" + host + ":" + port + "/bridge");
   this.ready = false;
   this.outputBuffer = [];
   var self = this;

   this.sock.onopen = function() {
     self.ready = true;
     self.processBuffer();
   }

   // process output buffer: messages that were sent by a client,
   // before the connection to sockJS server was established
   this.processBuffer = function() {
    if (this.outputBuffer.length > 0 && this.ready) 
      for(var i in this.outputBuffer) 
        this.sock.send( this.outputBuffer[i] );
   }

   this.sock.onmessage = function(e) {
     e.data = JSON.parse(e.data);
     if(e.data['sID']) {
        sID = e.data['sID'];

        if (e.data['eventName']) {
          self.sockets[sID].onEvent(e.data['eventName'], e.data['data']);
        }
        else {
          self.sockets[sID].ondata(e.data);
        }
     } else if (e.data['cID']) {
        cID = e.data['cID'];
        self.httpClients[cID].onEvent(e.data['eventName'], e.data['data']);
     }
   }

   this.sock.onclose = function() {
     console.log('close');
   }

   this.createSocket = function(host, port, options) {
     return new Socket(this, host, port, options);
   }

   this.createHTTPClient = function() {
     return new Http(this);
   }
}

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

// Socket client
var Socket = function(webtcp, host, port, options) {
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

   this.onSockOptsRcv = (function(that) { return function(opts) {
     that.sockOpts = opts;
     that.sockOpts['_updating'] = false;
   }}(this));

   this.getSockOpts = (function(that) { return function(callback) {
     that.sockOpts._updating = true;
     that.rpc("getSockOpts");
   }}(this));

 };

var WebTCPAPI = function() {
  this.onEvent = function(eventName, data) {
    this["on" + eventName](data);
    
    // call custom event handler
    if (this["on" + eventName + "Custom"])
      this["on" + eventName + "Custom"](data);
  };

  this.on = function(eventName, callback) {
    this["on" + eventName + "Custom"] = callback;
  };

  this.rpc = function(command, args) {
     var pck = this.createPacket();
     pck.command = command;
     pck.args = args;

     this.send( JSON.stringify(pck) );
     return 1;
   }

  this.write = function(data) {
     var pck = this.createPacket();
     pck.data = data;
     
     this.send( JSON.stringify(pck) );
     return 1;
   }

  this.send = function(data) {
     if(this.webtcp.ready)
       this.webtcp.sock.send(data);
     else if(this.webtcp.outputBuffer > this.webtcp.BUFF_SIZE) {
       throw "Output buffer is already full, but sockJS connection is not ready yet";
     }
     else {
       this.webtcp.outputBuffer.push(data);
     }
   }

  this.onerror = function(error) {
    throw error;
  }
}

Http.prototype = new WebTCPAPI();
Socket.prototype = new WebTCPAPI();