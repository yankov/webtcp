var error = {
	NoError: 0,
	OffsetOutOfRange: 1,
	InvalidMessage: 2,
	WrongPartition: 3,
	InvalidRetchSize:4
}

std.each(['NoError', 'OffsetOutOfRange', 'InvalidMessage', 'WrongPartition', 'InvalidRetchSize'], function(name, codeNum) {
	window[name] = codeNum
	window[codeNum] = name
})

