// var std = require('std'),
// 	events = require('events'),
// 	Connection = require('./Connection'),
// 	requestTypes = require('./requestTypes'),
// 	error = require('./error')

	
var Client = std.Class(Connection, function(supr) {
	var MS_TO_S = 1000
	
	var states = {
		HEADER_LEN_0: 0, HEADER_LEN_1: 1, HEADER_LEN_2: 2, HEADER_LEN_3: 3,
		HEADER_EC_0: 4, HEADER_EC_1: 5,
		RESPONSE_MSG_0: 6, RESPONSE_MSG_1: 7, RESPONSE_MSG_2: 8, RESPONSE_MSG_3: 9,
		RESPONSE_MAGIC: 10,
		RESPONSE_CHKSUM_0: 11, RESPONSE_CHKSUM_1: 12, RESPONSE_CHKSUM_2: 13, RESPONSE_CHKSUM_3: 14,
		RESPONSE_MSG: 15,
		
		OFFSET_LEN_0: 16, OFFSET_LEN_1: 17, OFFSET_LEN_2: 18, OFFSET_LEN_3: 19,
		OFFSET_OFFSETS_0: 20, OFFSET_OFFSETS_1: 21, OFFSET_OFFSETS_2: 22, OFFSET_OFFSETS_3: 23,
		OFFSET_OFFSETS_4: 24, OFFSET_OFFSETS_5: 25, OFFSET_OFFSETS_6: 26, OFFSET_OFFSETS_7: 27,
	}
	
	var defaults = {
		maxSize: 1048576 //1MB
	}

	var fetch_defaults = {
		type: requestTypes.FETCH,
		next: states.RESPONSE_MSG_0,
		last: 'lastmessage',
		encode: function (t) {
			return this._encodeFetchRequest(t)
		},
		
		partition: 0,
		offset: 0,
	}
	
	var offset_defaults = {
		type: requestTypes.OFFSETS,
		next: states.OFFSET_LEN_0,
		last: 'lastoffset',
		encode: function (t) {
			return this._encodeOffsetsRequest(t)
		},

		partition: 0,
		offsets: 1,
	}

	this.init = function(opts) {
		supr(this, 'init', arguments)
		opts = std.extend(opts, defaults)
		this._buffer = new Buffer(opts.maxSize)		
		this._toRead = 0
		this._requests = []
		this._connected = false
		this._state = states.HEADER_LEN_0
		fetch_defaults.encode = fetch_defaults.encode.bind(this)
		offset_defaults.encode = offset_defaults.encode.bind(this)
	}

	this.connect = function() {
		supr(this, 'connect', arguments)
		this._connection.on('connect', std.bind(this, '_onConnect'))
		return this
	}
		
	this.fetchTopic = function(args) {
		var request = std.extend(args.name == undefined ? { name: args } : args, fetch_defaults)
		this._pushRequest(request)
		return this
	}
	
	this.fetchOffsets = function(args) {
		var request = std.extend(args.name == undefined ? { name: args } : args, offset_defaults)
		this._pushRequest(request)
		return this
	}
	
	this._onConnect = function() {
		this._connected = true
		this._connection.on('data', std.bind(this, '_onData'))
		for (i in this._requests) this._writeRequest(this._requests[i])
	}
	
	this._pushRequest = function(request) {
		this._requests.push(request)
		this._writeRequest(request)		
	}
	
	this._writeRequest = function(request) {
		if (this._connected) this._connection.write(request.encode(request))
	}

	this._encodeFetchRequest = function(t) {
		var request = std.pack('n', requestTypes.FETCH)
			+ std.pack('n', t.name.length) + t.name
			+ std.pack('N', t.partition)
			+ std.pack('N2', t.offset & 0xffff0000 >> 32, t.offset & 0x0000ffff)
			+ std.pack('N', this._buffer.length)

		var requestSize = 2 + 2 + t.name.length + 4 + 8 + 4

		return this._bufferPacket(std.pack('N', requestSize) + request)
	}

	this._encodeOffsetsRequest = function(t) {
		var time = new Date().getTime() / MS_TO_S
		var request = std.pack('n', requestTypes.OFFSETS)
			+ std.pack('n', t.name.length) + t.name
			+ std.pack('N', t.partition)
			+ std.pack('N2', time & 0xffff0000 >> 32, time & 0x0000ffff)
			+ std.pack('N', t.offsets)
	
		var requestSize = 2 + 2 + t.name.length + 4 + 8 + 4
		return this._bufferPacket(std.pack('N', requestSize) + request)
	}
	
	this._onData = function(buf) {
/** 
 * the following tests buffer sizes smaller than what normally
 * comes off the socket.  It breaks the normal boundaries and helps
 * ensure the parsing code is robust
 *
		var buffer = new Buffer(buf.length - 2)
		buf.copy(buffer, 0, 0, buf.length - 2)
		this._processData(buffer)
				
		buffer = new Buffer(2)
		buf.copy(buffer, 0, buf.length - 2, buf.length)
		this._processData(buffer)
	}
	
	this._processData = function (buf) {
*/
		var index = 0		
		while (index != buf.length) {
			var bytes = 1
			var next = this._state + 1
			switch (this._state) {					
				case states.HEADER_LEN_0:
					this._totalLen = buf[index] << 24
				    break
				
				case states.HEADER_LEN_1:				
				    this._totalLen += buf[index] << 16
				    break
					
				case states.HEADER_LEN_2:				
				    this._totalLen += buf[index] << 8
				    break

				case states.HEADER_LEN_3:		
				    this._totalLen += buf[index]
				    break
				
				case states.HEADER_EC_0:
					this._error = buf[index] << 8
					this._totalLen--
				    break
				    
				case states.HEADER_EC_1:
					this._error += buf[index]
					this._toRead = this._totalLen
					next = this._requests[0].next
					this._totalLen--
					if (this._error != error.NoError) this.emit('error', this._error, error[this._error])
				    break
				
				case states.RESPONSE_MSG_0:
				    this._msgLen = buf[index] << 24
					this._requests[0].offset++
				    this._payloadLen = 0
				    break

				case states.RESPONSE_MSG_1:				
			    	this._msgLen += buf[index] << 16
					this._requests[0].offset++
				    break

				case states.RESPONSE_MSG_2:				
			    	this._msgLen += buf[index] << 8
					this._requests[0].offset++
				    break

				case states.RESPONSE_MSG_3:				
			    	this._msgLen += buf[index]
					this._requests[0].offset++
				    break
				
				case states.RESPONSE_MAGIC:	
			    	this._magic = buf[index]
					this._requests[0].offset++
			        this._msgLen--
				    break

				case states.RESPONSE_CHKSUM_0:
			    	this._chksum = buf[index] << 24
					this._requests[0].offset++
		        	this._msgLen--
				    break

				case states.RESPONSE_CHKSUM_1:				
				    this._chksum += buf[index] << 16
					this._requests[0].offset++
					this._msgLen--
				    break

				case states.RESPONSE_CHKSUM_2:				
		        	this._chksum += buf[index] << 8
					this._requests[0].offset++
				    this._msgLen--
				    break

				case states.RESPONSE_CHKSUM_3:				
		        	this._chksum += buf[index]
					this._requests[0].offset++
				    this._msgLen--
				    break
				
				case states.RESPONSE_MSG:
					next = states.RESPONSE_MSG
					
					// try to avoid a memcpy if possible
					var payload = null
					if (this._payloadLen == 0 && buf.length - index >= this._msgLen) {
						payload = buf.toString('utf8', index, index + this._msgLen)
						bytes = this._msgLen
					} else {
						var end = index + this._msgLen - this._payloadLen
						if (end > buf.length) end = buf.length
						buf.copy(this._buffer, this._payloadLen, index, end)
						this._payloadLen += end - index
						bytes = end - index
						if (this._payloadLen == this._msgLen) {														
							payload = this._buffer.toString('utf8', 0, this._payloadLen)
						}
					}
					if (payload != null) {
						this._requests[0].offset += payload.length
						next = states.RESPONSE_MSG_0
						this.emit('message', this._requests[0].name, payload, this._requests[0].offset)
					}
					break
					
				case states.OFFSET_LEN_0: 
					this._msgLen = buf[index] << 24
					break
					
				case states.OFFSET_LEN_1: 
					this._msgLen += buf[index] << 16
					break
				
				case states.OFFSET_LEN_2:
					this._msgLen += buf[index] << 8
					break
					
				case states.OFFSET_LEN_3:
					this._msgLen += buf[index]
					break
				
				case states.OFFSET_OFFSETS_0:
					this._requests[0].offset = buf[index] << 56
					break
				
				case states.OFFSET_OFFSETS_1:
					this._requests[0].offset += buf[index] << 48
					break
					
				case states.OFFSET_OFFSETS_2:
					this._requests[0].offset += buf[index] << 40
					break
					
				case states.OFFSET_OFFSETS_3:
					this._requests[0].offset += buf[index] << 32
					break

				case states.OFFSET_OFFSETS_4:
					this._requests[0].offset += buf[index] << 24
					break
					
				case states.OFFSET_OFFSETS_5:
					this._requests[0].offset += buf[index] << 16
					break
					
				case states.OFFSET_OFFSETS_6:
					this._requests[0].offset += buf[index] << 8
					break
				
				case states.OFFSET_OFFSETS_7:
					this._requests[0].offset += buf[index]			
					next = states.OFFSET_OFFSETS_0
					this.emit('offset', this._requests[0].name, this._requests[0].offset)
			}			
			index += bytes
			this._toRead -= bytes
			this._state = next
			if (this._toRead == 0) this._last()
		}
	}	
	
	this._last = function() {
		var last = this._requests.shift()
		this.emit(last.last, last.name, last.offset)
		this._state = states.HEADER_LEN_0

	}
})
