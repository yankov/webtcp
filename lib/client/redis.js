// Redis client to work with WebTCP server
// Check out example of using it in examples/redis_client.html
// author: Artem Yankov (artem.yankov@gmail.com)

function Redis(webtcp, host, port, options) {
  this.webtcp = webtcp;
  this.conn = net.createSocket(host, port, options);
  this.callbacks = [];
  this.subscribeCallbacks = {};

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

  this.deleteReply = function(data, reply, isBulk){
    if (isBulk)
      offset = (3 + reply.length.toString().length);
    else
      offset = 1;

    return data.slice(offset + reply.length + 2);
  }

  this.parseBulk = function(data) {
    var data = data.substr(1);
    var reply_size = data.split("\r\n")[0];

    return data.slice(2 + reply_size.length, (2 + reply_size.length) + parseInt(reply_size));
  }

  this.parseReply = function(data) {
    var replies = [];
    var commandCount = 0;

    while(data.length > 2) {
      commandCount += 1;

      if (commandCount > 1000) {
        console.error("Command counter is too big. Corrupted response? data = " + data);
        return replies;
      }

      var code = data.charAt(0);
      // single-line reply 
      if (code == '+' || code == '-' || code == ':') {
        reply = data.substr(1).split("\r\n")[0];
        data = this.deleteReply(data, reply, false);
        replies.push(reply);
      }  
      // bulk reply 
      else if (code == '$') {
        reply = this.parseBulk(data);
        data = this.deleteReply(data, reply, true);

        replies.push(reply)
      } 
      // multi-bulk reply
      else if (code == '*') {
        data = data.substr(1);
        reply_size = data.split("\r\n")[0];
        data = data.slice(reply_size.length + 2, data.length)
        bulkReplies = []

        for (var i=1; i<=parseInt(reply_size); i+=1) {
          reply = this.parseBulk(data);

          data = this.deleteReply(data, reply, true);
          bulkReplies.push(reply)
        }

        replies.push(bulkReplies);
      }
    }

    return replies;
  }

  this.conn.on('data', function(res) {
    var replies = self.parseReply(res);

    for (var i in replies) {
      
      if ( typeof replies[i] == "object" && replies[i][0] == "message" ) {
        callback = self.subscribeCallbacks[ replies[i][1] ];
        callback( { channel: replies[i][1], message: replies[i][2] } );
      }
      else {
        if (replies[i][0] != "subscribe" && replies[i][0] != "ubsubscribe") {
          callback = self.callbacks.shift();
          if (callback)
            callback( replies[i] );    
        }
      }
    }
  })

  this.send = function(command, callback) {
    data = this.to_redis_proto(command);

    // handle subscribe command
    if(command.match(/^\s*subscribe/)) {
      channels = command.replace(/^\s*subscribe\s*/,'').split(/\s+/)
      
      for (var i in channels) 
        this.subscribeCallbacks[ channels[i] ] = callback;
    } 
    else
      this.callbacks.push(callback);

    packetId = this.conn.write(data);
    return packetId;
  }

  this.on = function(eventName, callback) {
    this["on" + eventName + "Custom"] = callback;
  }

}