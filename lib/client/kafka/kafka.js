// Apache Kafka client
function Kafka(webtcp, host, port, options) {
  
  var requestTypes = {
    PRODUCE     : 0,
    FETCH       : 1,
    MULTIFETCH  : 2,
    MULTIPRODUCE: 3,
    OFFSETS     : 4
  };

  this.webtcp = webtcp;
  this.conn = net.createSocket(host, port, options);
  this.callbacks = [];
  this.subscribeCallbacks = {};
  this._topic = "test";
  this._partition = 0;

  this._magicValue = 0;
  this._requestType = requestTypes.PRODUCE;
  
  var self = this;

  this.conn.on('data', function(data) {
    data = self.parseReply(data);
    self["ondataCustom"](data);
  })

  this.on = function(eventName, callback) {
    this["on" + eventName + "Custom"] = callback;
  }

  this._bufferPacket = function(packet) {
    var len = packet.length,
        buffer = [] 

    for (var i=0; i<len; i++) {
      buffer[i] = packet.charCodeAt(i)
    }

    return buffer
  }

  this._encodeMessage = function(message) {
    return pack('CN', this._magicValue, crc32(message)) + message
  }

  this._encodeRequest = function(topic, partition, messages) {
    var encodedMessages = ''
    for (var i=0; i<messages.length; i++) {
      var encodedMessage = this._encodeMessage(messages[i])
      encodedMessages += pack('N', encodedMessage.length) + encodedMessage
    }

    var request = pack('n', this._requestType)
      + pack('n', topic.length) + topic
      + pack('N', partition)
      + pack('N', encodedMessages.length) + encodedMessages

    return this._bufferPacket(pack('N', request.length) + request)
  }

  this.send = function(messages, topic, partition, callback) {
    if (typeof topic == 'undefined') { topic = this._topic };
    if (typeof partition == 'undefined') { partition = this._partition };
    if (!(messages instanceof Array)) { messages = [messages] };

    this.conn.write( this._encodeRequest(topic, partition, messages) );
  }

}