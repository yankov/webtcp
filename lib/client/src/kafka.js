// Apache Kafka client
function Kafka(webtcp, host, port, options) {
  this.webtcp = webtcp;
  this.conn = net.createSocket(host, port, options);
  this.callbacks = [];
  this.subscribeCallbacks = {};
  
  var self = this;

  this.conn.on('data', function(data) {
    data = self.parseReply(data);
    self["ondataCustom"](data);
  })


  this.on = function(eventName, callback) {
    this["on" + eventName + "Custom"] = callback;
  }

}