// Redis client

function Redis(webtcp, host, port, options) {
  this.webtcp = webtcp;
  this.conn = net.createSocket(host, port, options);
  var self = this;

  this.conn.on('data', function(data) {
    data = self.parseReply(data);
    self["ondataCustom"](data);
  })

  this.to_redis_proto = function(command_str) {
    args = command_str.split(/ +/);
    str =  "*" + args.length + "\r\n";
    for (i = 0; i < args.length; i++) {

      var arg = args[i];
      str += "$" + arg.length + "\r\n" + arg + "\r\n";
    }

    return str;
  }


  this.parseReply = function(data) {
    var code = data.charAt(0);
    data = data.substr(1).split("\r\n");
    result = [];

    for (var i in data) {
     //skip first line if it's bulk response
     if ( (code == '$' || code == '*') && i == 0) continue;

     if (data[i] != "" && data[i].charAt(0) != "$" && data[i].charAt(0) != "*")
       result.push(data[i]);
    }

    if (result.length == 1) result = result[0];

    return result;
  }

  this.send = function(command, callback) {
    data = this.to_redis_proto(command);
    this.on('data', callback);

    this.conn.write(data);
  }

  this.on = function(eventName, callback) {
    this["on" + eventName + "Custom"] = callback;
  }
}