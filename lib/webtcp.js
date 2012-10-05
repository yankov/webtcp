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
         s_id = e.data.s_id

         if(s_id) {
            if (e.data == "CONNECTED")
              this.sockets[s_id].onconnect();   
            else
              this.sockets[s_id].ondata(e.data);
         }

         console.log(e.data);
     };
     this.sock.onclose = function() {
         console.log('close');
     };

     this.Socket = (function(webtcp) {
       return function(host, port, options) {
        this.socket_id = Math.random().toString(36).substr(2); 
        webtcp.sockets[this.socket_id] = this;
        this.ready = false;

        this.remoteAddress = host;
        this.remotePort = port;
        this.packet = {
          s_id: this.socket_id,
          host: this.remoteAddress,
          port: this.remotePort,
          data: null
        }

       this.connect = function() {
         this.write("TCP CONNECT");
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