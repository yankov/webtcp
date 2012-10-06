var WebTCP = function(host, port) {
  
   this.sockets = {};
   this.sock = new SockJS("http://" + host + ":" + port + "/bridge");

     this.sock.onopen = function() {
         console.log('open');

         // activate sockets from buffer here
     };

     this.sock.onmessage = (function(that) { return function(e) {
         e.data = JSON.parse(e.data);
         sID = e.data['sID'];

         if(sID) {
            if (e.data == "CONNECTED") {
              that.sockets[sID].ready = true;
              that.sockets[sID].onconnect();   
            }
            else {
              console.log('received');
              that.sockets[sID].ondata(e.data);
            }
         }

     }}(this));

     this.sock.onclose = function() {
       console.log('close');
     };

     this.Socket = (function(webtcp) {
       return function(host, port, options) {
        this.sID = Math.random().toString(36).substr(2); 
        webtcp.sockets[this.sID] = this;
        this.ready = false;

        this.remoteAddress = host;
        this.remotePort = port;
        this.packet = {
          sID: this.sID,
          host: this.remoteAddress,
          port: this.remotePort,
          data: null
        }

       this.connect = function() {
       }

       this.end = function() {

       }

       this.onconnect = function() {

       }

       this.ondata = function(data) {

       }

       this.write = function(data) {
         pck = this.packet;
         pck.data = data;
         
         webtcp.sock.send( JSON.stringify(pck) );
       }
     }})(this);
}