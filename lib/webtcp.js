var WebTCP = function(host, port) {
   var BUFF_SIZE = 10;

   this.sockets = {};
   this.httpClients = {};
   this.sock = new SockJS("http://" + host + ":" + port + "/bridge");
   this.ready = false;
   this.outputBuffer = [];

     this.sock.onopen = (function(that) { 
      return function() {
        that.ready = true;
        that.processBuffer.call(that);
     }}(this));

     this.processBuffer = function() {
      if (this.outputBuffer.length > 0 && this.ready) {
        for(var i in this.outputBuffer) {
          this.sock.send( this.outputBuffer[i] );
        }
      }
     }

     this.sock.onmessage = (function(that) { return function(e) {
         e.data = JSON.parse(e.data);
         if(e.data['sID']) {
            sID = e.data['sID'];

            if (e.data['eventName']) {
              that.sockets[sID].onEvent(e.data['eventName'], e.data['data']);
            }
            else {
              that.sockets[sID].ondata(e.data);
            }
         } else if (e.data['cID']) {
            cID = e.data['cID'];
            that.httpClients[cID].onEvent(e.data['eventName'], e.data['data']);
         }

     }}(this));

     this.sock.onclose = function() {
       console.log('close');
     };

     // Socket client
     this.Socket = (function(webtcp) {
       return function(host, port, options) {
        this.sID = Math.random().toString(36).substr(2); 
        webtcp.sockets[this.sID] = this;
        this.ready = false;
        this.closed = false;
        this.options = options;
        this.sockOpts = { _updating: false }

        this.remoteAddress = host;
        this.remotePort = port;

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

       this.onEvent = (function(that) { 
        return function(eventName, data) {

          that["on" + eventName](data);
          
          // call custom event handler
          if (that["on" + eventName + "Custom"])
            that["on" + eventName + "Custom"](data);

        }})(this);

       this.on = (function(that) { 
        return function(eventName, callback) {
           that["on" + eventName + "Custom"] = callback;
       }})(this);

       this.onconnect = function() {
         webtcp.sockets[sID].ready = true;
         webtcp.sockets[sID].closed = false;
       }

       this.ondata = function(data) {}

       this.onend = function() {}
       this.ontimeout = function() {}
       this.ondrain = function() {}

       this.onclose = function() {
         webtcp.sockets[sID].ready = false;
         webtcp.sockets[sID].closed = true;
       }

       this.onerror = function(error) {
         throw error;
       }

       this.onSockOptsRcv = (function(that) { return function(opts) {
         that.sockOpts = opts;
         that.sockOpts['_updating'] = false;
       }}(this));

       this.getSockOpts = (function(that) { return function(callback) {
         that.sockOpts._updating = true;
         that.rpc("getSockOpts");
       }}(this));

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
         if(webtcp.ready)
           webtcp.sock.send(data);
         else if(webtcp.outputBuffer > webtcp.BUFF_SIZE) {
           throw "Output buffer is already full, but sockJS connection is not ready yet";
         }
         else {
           webtcp.outputBuffer.push(data);
         }
       }

     }})(this);

     // HTTP client
     this.Http = (function(webtcp) {
      return function() {
        this.cID = Math.random().toString(36).substr(2); 
        webtcp.httpClients[this.cID] = this;

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

        this.onEvent = (function(that) { 
        return function(eventName, data) {

          that["on" + eventName](data);
          
          // call custom event handler
          if (that["on" + eventName + "Custom"])
            that["on" + eventName + "Custom"](data);

        }})(this);

       this.on = (function(that) { 
        return function(eventName, callback) {
           that["on" + eventName + "Custom"] = callback;
       }})(this);

       this.ondata = function(data) { 
       }

       this.get = (function(that) {
         return function(options, callback) {
           that.on('data', callback);
           that.rpc("httpGet", options);
         }}(this))

       this.rpc = function(command, args) {
         var pck = this.createPacket();
         pck.command = command;
         pck.args = args;

         this.send( JSON.stringify(pck) );
         return 1;
       }

       this.send = function(data) {
         if(webtcp.ready)
           webtcp.sock.send(data);
         else if(webtcp.outputBuffer > webtcp.BUFF_SIZE) {
           throw "Output buffer is already full, but sockJS connection is not ready yet";
         }
         else {
           webtcp.outputBuffer.push(data);
         }
       }
       
      }

     }(this))
}