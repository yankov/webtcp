var WebTCP = function(host, port) {
  
   this.sockets = {};
   this.sock = new SockJS("http://" + host + ":"+ port + "/bridge");

     this.sock.onopen = function() {
         console.log('open');

         for(i in sockets) {
           sockets[i].connect();
         }
     };
     this.sock.onmessage = function(e) {
         sID = e.data.sID

         if(sID) {
            if (e.data == "CONNECTED") {
              console.log(sID + " connected");
              this.sockets[sID].ready = true;
              this.sockets[sID].onconnect();   
            }
            else
              this.sockets[sID].ondata(e.data);
         }

         console.log(e.data);
     };
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