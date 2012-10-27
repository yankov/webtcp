// var std = require('std'),
// 	Connection = require('./Connection'),
// 	requestTypes = require('./requestTypes')

var Producer = std.Class(Connection, function(supr) {
	
	this._magicValue = 0
	this._requestType = requestTypes.PRODUCE
	
	var defaults = {
		topic: 'test',
		partition: 0
	}

	this.init = function(opts) {
		supr(this, 'init', arguments)
		opts = std.extend(opts, defaults)
		this._partition = opts.partition
		this._topic = opts.topic
	}

	this.send = function(messages, topic, partition) {
		if (typeof topic == 'undefined') { topic = this._topic }
		if (typeof partition == 'undefined') { partition = this._partition }
		if (!(messages instanceof Array)) { messages = [messages] }

		console.log( this._encodeRequest(topic, partition, messages) )	
		this._connection.write(this._encodeRequest(topic, partition, messages))
		return this
	}

	this._encodeRequest = function(topic, partition, messages) {
		var encodedMessages = ''
		for (var i=0; i<messages.length; i++) {
			var encodedMessage = this._encodeMessage(messages[i])
			encodedMessages += std.pack('N', encodedMessage.length) + encodedMessage
		}

		var request = std.pack('n', this._requestType)
			+ std.pack('n', topic.length) + topic
			+ std.pack('N', partition)
			+ std.pack('N', encodedMessages.length) + encodedMessages
		
		return this._bufferPacket(std.pack('N', request.length) + request)
	}

	this._encodeMessage = function(message) {
		return std.pack('CN', this._magicValue, std.crc32(message)) + message
	}
})
