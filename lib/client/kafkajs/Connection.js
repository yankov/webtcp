// var std = require('std'),
// 	net = require('net'),
// 	events = require('events')

var Connection = std.Class(events, function() {

	var defaults = {
		host: 'localhost',
		port: 9092
	}

	this.init = function(opts) {
		opts = std.extend(opts, defaults)
		this._host = opts.host
		this._port = opts.port
	}

	this.connect = function(callback) {
		if (this._connection) { throw new Error("connect called twice") }
		this._connection = net.createSocket(this._host, this._port)
		this._connection.on('connect', std.bind(this, 'emit', 'connect'))
		this._connection.on('error', std.bind(this, 'emit', 'error'))
		if (callback != undefined) this._connection.on('connect', callback)
		return this
	}

	this.close = function() {
		this._connection.end()
		delete this._connection
		return this
	}
	
	this._bufferPacket = function(packet) {
		var len = packet.length,
			buffer = [] // replaced new Buffer(len)

		for (var i=0; i<len; i++) {
			buffer[i] = packet.charCodeAt(i)
		}

		return buffer
	}
})
