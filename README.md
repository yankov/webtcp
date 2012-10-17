WebTCP 0.0.1
============
WebTCP is a SockJS/TCP bridge that allows browsers to interact with remote TCP servers and
make HTTP requests to any servers bypassing same-origin policy.

How does it work
================
Client and server (bridge) communicate through [SockJS](https://github.com/sockjs/sockjs-node) connection. When browser
wants to create a TCP socket it sends a command to the bridge. Bridge creates a real TCP socket connection and maps all the events 
that happen on this socket to a client's socket object. For example, when data is received bridge will trigger a data event on 
according socket object on a browser side. **Screw my writings, here's the picture**:  
![diagram](http://pix.am/kSZT.png)

Why would anyone need that
==========================
I don't know, but you can do interesting things like:  

* create client libraries to interract with any TCP servers 'directly' from your browser: Redis, Memcached, MySQL, MongoDB, etc.
* make GET/POST queries to any destination regardless of same-origin policy. 

Install and run
===============

Assuming you have `node.js` and `npm` installed:

**Clone the repo**  
`git clone https://github.com/yankov/webtcp`  

**Install dependencies**  
`cd webtcp`  
`npm install` 

**Run the server**  
`cd examples && node server`  

**Open client examples in the browser**  
`examples/http_client.html` for http requests examples 


Examples
========

**TCP echo server**

`cd examples && node tcp_server` run example server
`examples/socket_client.html` open in the browser 




How to use it
=============  
First create a SockJS tunnel. Use whatever port and address your WebTCP server is on.  
`var net = new WebTCP('localhost', 9999)`

Creating sockets
----------------  
Now you can create sockets like this  

`var socket = net.createSocket("127.0.0.1", 1337)`  

To send data simply use write function

`socket.write("hi")`  

**Standard event handlers**  

    // On connection callback
    socket.on('connect', function(){
      console.log('connected');
    })
    
    // This gets called every time new data for this socket is received
    socket.on('data', function(data) {
      console.log("received: " + data);
    });
    
    socket.on('end', function(data) {
      console.log("socket is closed ");
    });

It's also possible to specify advanced options when creating a socket connection  

    options = {
      encoding: "utf-8",
      timeout: 0,
      noDelay: true, // disable/enable Nagle algorithm
      keepAlive: false, //default is false
      initialDelay: 0 // for keepAlive. default is 0
    }

And then pass those options when creating socket  

`var socket = net.createSocket("127.0.0.1", 1337, options)`

Making HTTP requests
--------------------
Making HTTP request is pretty straightforward.  

**Create a http client**  

`var client = net.createHTTPClient()`  

**GET request**  

    client.get({ host: 'news.ycombinator.com', port: 80 }, function(res) {
      console.log(res);
    });
  
**POST request**  

    client.post({ host: 'news.ycombinator.com', port: 80 }, { param: 1 }, function(res) {
      console.log(res);
    });

TODO
====
* Security checks [hello vkluch?]
* Implement clients for redis, memcached, kafka
* Rails rack middleware (probably for HTTP only)