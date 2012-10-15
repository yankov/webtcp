var WebTCP = require('../server/webtcp.js').WebTCP

var server = new WebTCP();
server.listen(9999, "127.0.0.1");
