function WebTCP(host, port) {
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
        self.sockets[sID].onEvent(e.data['eventName'], e.data['data']);
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
