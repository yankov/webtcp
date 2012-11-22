// This is responsible for handling events
// that were triggered by a client (from a browser)

module.exports.clientEvents = function() {
  // trigger an event on a client side
  this.emitClientEvent = function(eventName, data) {
    var pck = this.createPacket();
    pck.eventName = eventName;
    pck.data = data;
    this.sockjsConn.write( JSON.stringify(pck) );     
  }

  this._bufferPacket = function(packet) {
    var len = packet.length,
        buffer = new Buffer(len);

    for (var i=0; i<len; i++) {
      buffer[i] = packet[i]
    }

    return buffer
  }

  // process messages comming from a client
  this.onClientData = function(data) {
    // client can either send data or make a function call
    // TODO: whitelist allowed functions!
    if (data.command && typeof this[data.command] == "function") {
      this[data.command].apply(this, data['args']);
    }
    else {

      if (typeof data.data == 'object')
        data.data = this._bufferPacket(data.data);

      this.client.write(data.data);  
    }
  };
}