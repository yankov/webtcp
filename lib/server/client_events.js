module.exports.clientEvents = function() {
  // trigger an event on a client side
  this.emitClientEvent = function(eventName, data) {
    var pck = this.createPacket();
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }

  // process messages comming from a client
  this.onClientData = function(data) {
    // client can either send data or make a function call
    // TODO: whitelist allowed functions!
    if (data.command && typeof this[data.command] == "function") {
      this[data.command].apply(this, data['args']);
    }
    else 
      this.client.write(data.data);  
  };
}