// This is a WebTCP server that is gonna be proxying 
// all client TCP requests

// Is there a better way to do that?
var WebTCP = require('../lib/server/webtcp.js').WebTCP

var server = new WebTCP();
server.listen(9999, "127.0.0.1");
