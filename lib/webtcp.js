var WebTCP = function(host, port) {
    
   this.sock = new SockJS("http://" + host + ":"+ port +"/bridge");

     this.sock.onopen = function() {
         console.log('open');
     };
     this.sock.onmessage = function(e) {
         console.log(e.data);
     };
     this.sock.onclose = function() {
         console.log('close');
     };

     this.Socket = (function(webtcp) {
       return function(host, port, options) {
        this.remoteAddress = host;
        this.remotePort = port;
        this.packet = {
          host: this.remoteAddress,
          port: this.remotePort,
          data: ""
        }

       this.write = function(data) {
         this.packet.data = data;
         
         webtcp.sock.send( JSON.stringify(this.packet) );
       }
     }})(this);
}