// var std = require('std'),
// 	events = require('events'),
// 	Client = require('./Client'),
// 	requestTypes = require('./requestTypes'),
// 	error = require('./error')

var Consumer = std.Class(Client, function(supr) {

	var defaults = {
		pollInterval: 2000,
	}
	
	var subscription_defaults = {
		offset: 0,
		partition: 0,
	}

	this.init = function(opts) {
		supr(this, 'init', arguments)
		opts = std.extend(opts, defaults)
		this._pollInterval = opts.pollInterval
		this._topics = []
		this._outstanding = 0
		this._shouldPoll = false
		
		this.on('lastmessage', std.bind(this, '_processLast'))
	}
	
	this.close = function() {
		supr(this, 'close')
		this._unschedulePoll()
	}

	this.subscribeTopic = function(opts) {
		var topic = opts.name == undefined ? { name:opts, offset:0, partition: 0 } : std.extend(opts, subscription_defaults)
		this._topics.push(topic)
		if (this._topics.length == 1) this._schedulePoll()
		return this
	}

	this.unsubscribeTopic = function(name) {
		this._topics = this._topics.filter(function(x) { return x.name == name })
		if (this._topics.length == 0) this._unschedulePoll()
		return this
	}
	
	this._pollForMessages = function() {
		if (this._outstanding > 0 || !this._shouldPoll) return
		this._shouldPoll = false

		for (i in this._topics) {
			this._outstanding++
			this.fetchTopic(this._topics[i])
		}
	}
	
	this._processLast = function(topic, offset) {
		for (i in this._topics) if (this._topics[i].name == topic) {
			this._topics[i].offset = offset
			this._outstanding--
			this._pollForMessages()
			break
		}
	}
	
	this._schedulePoll = function() {
		this._timeoutID = setTimeout(std.bind(this, '_schedulePoll'), this._pollInterval)
		this._shouldPoll = true
		this._pollForMessages()
	}
	
	this._unschedulePoll = function() {
		clearTimeout(this._timeoutID)
		this._shouldPoll = false
	}
})
