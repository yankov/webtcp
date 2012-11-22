// Socket library
// When client wants to open a connection to some TCP server,
// a real socket connection is created on a server side and all events
// are mapped to a socket object on a client (browser) side.

var net = require('net');
var clientEvents = require('./client_events.js').clientEvents;

module.exports.Socket = function(webtcp, remoteSocketId, host, port, options) {
  // socket events that are mapped to client socket objects
  var EVENTS = ["connect", "data", "end", "close", "timeout", "drain", "error"];

  // sockjs connection
  this.sockjsConn = webtcp.sockjsConn;
  this.remoteSocketId = remoteSocketId;
  this.remoteAddress = host;
  this.remotePort = port;
  options = options || {};
  
  var self = this;

  this.options = {
    //Makes the 'data' event emit a string instead of a Buffer.
    //Can be 'utf8', 'utf16le' ('ucs2'), 'ascii', or 'hex'
    encoding: options.encoding || 'utf8', 

    //Sets the socket to timeout after timeout milliseconds of inactivity on the socket
    timeout: options.timeout || 0,

    //Disables the Nagle algorithm
    noDelay: options.noDelay || false, 

    // keepAlive: options.keepAlive || false, 

    //Set the delay between the last data packet received and the first keepalive probe
    initialDelay: options.initialDelay || 0
  }

  this.createPacket = function() { 
    return {
      sID: this.remoteSocketId,
      eventName: null,
      data: null
    }
  }

  this.bufferPacket = function(packet) {
    var len = packet.length,
      buffer = new Buffer(len)

    for (var i=0; i<len; i++) {
      buffer[i] = packet.charCodeAt(i)
    }

    return buffer
  }


  this.setOptions = function() {
    this.client.setEncoding(this.options.encoding);
    this.client.setTimeout(this.options.timeout);
    this.client.setNoDelay(this.options.noDelay);
    this.client.setKeepAlive(this.options.keepAlive, this.options.initialDelay);
  }

  this.client = new net.Socket();
  this.client.connect(this.remotePort, this.remoteAddress, function() { 
    self.setOptions();
  });

  // map socket events to socket objects (on a browser side),
  // so that when event is happened it triggers an according event 
  // on a browser side
  this.mapEvent = function(eventName) {
    this.client.on(eventName, function(data){
      
      // if (data) data = self.bufferPacket(data);
      // console.log('got data')

      if(data) data = data.toString();
      self.emitClientEvent(eventName, data); 

      // also delete socket object if one of these events happened
      // so if client send data again - it'll try to re-establish new connection
      if (["end", "close", "timeout"].indexOf(eventName) != -1) 
        delete webtcp.websockets[self.remoteSocketId];

    });
  }

  //map server socket events to client's socket events
  this.mapEvents = function(events) {
    for(i in events) 
      this.mapEvent.call(this, events[i]);
  }

  this.mapEvents.call(this, EVENTS);

  this.getSockOpts = function() {
    var sockOpts = {
      _pendingWriteReqs: this.client._pendingWriteReqs,
      _connectQueueSize: this.client._connectQueueSize,
      destroyed:         this.client.destroyed,
      errorEmitted:      this.client.errorEmitted,
      bytesRead:         this.client.bytesRead,
      bytesWritten:      this.client.bytesWritten,
      allowHalfOpen:     this.client.allowHalfOpen,
      _connecting:       this.client._connecting,
      writable:          this.client.writable,
      readable:          this.client.readable,
    }

    this.emitClientEvent("SockOptsRcv", sockOpts); 
  }

}

module.exports.Socket.prototype = new clientEvents();