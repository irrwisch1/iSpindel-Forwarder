#!/usr/bin/node

const net = require("net");

const server = net.createServer(function(socket) {
	console.log("new connection from " + socket.address().address + ":" + socket.address().port);

	socket.on("data", function(data) {
		try {
			console.log("got data");
		}
		catch (err) {
			console.log("invalid JSON data received: " + err);
		}
	});

	socket.on('close', function(data) {
		console.log("connection closed");
	});

});

server.listen(9501, function() {
	console.log("iSpindel-Forwarder listening on port " + server.address().port);
});
