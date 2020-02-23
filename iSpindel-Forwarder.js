#!/usr/bin/node

const net = require("net");
const request = require('request');
const querystring = require('querystring');

var config = require("./config.json");

/* Possible return values from a forwarder
   Success: Data has been successfully transmitted
   Error: Either configuration error or a non-recoverable error during transmission. Data will be discarded
   Buffer: Error during transmission that can potentially be recovered (i.e. timeout, server cannot be reached)
		   Data will be buffered and tried to be sent again periodically
*/
const forwardReturnVal = {
	Success: 1,
	Error: 2,
	Buffer: 3
};

const color = {
	reset: "\033[0m\033[39m",
	black: "\033[0m\033[30m",
	red:"\033[0m\033[31m",
	green: "\033[0m\033[32m",
	yellow: "\033[0m\033[33m",
	blue: "\033[0m\033[34m",
	magenta: "\033[0m\033[35m",
	cyan: "\033[0m\033[36m",
	white: "\033[0m\033[37m",
	light_black: "\033[1m\033[30m",
	light_red: "\033[1m\033[31m",
	light_green: "\033[1m\033[32m",
	light_yellow: "\033[1m\033[33m",
	light_blue: "\033[1m\033[34m",
	light_magenta: "\033[1m\033[35m",
	light_cyan: "\033[1m\033[36m",
	light_white: "\033[1m\033[37m"
};

function log(sys, msg) {
	var d = new Date();
	console.log(color.reset + "[" + color.yellow + sys + color.reset + "]", d.toLocaleString(), msg, color.reset);
}

function logs(sys, msg, status) {
	var statusStr;

	if (!status) {
		statusStr = color.red + "Fail" + color.reset;
	}
	else {
		statusStr = color.green + "OK" + color.reset;
	}

	var d = new Date();
	console.log(color.reset + "[" + color.yellow + sys + color.reset + "]", d.toLocaleString(), msg, "[" + statusStr + "]");
}


const server = net.createServer(function(socket) {
	log("Main", "new connection from " + socket.address().address + ":" + socket.address().port);

	var json = "";

	socket.on("data", function(data) {
		var s = data.toString();
		json += s;
	});

	socket.on('error', function() {
		console.log("error");
	});

	socket.on('close', function() {
		try {
			var obj = JSON.parse(json.toString());
			handleData(obj);
		}
		catch (err) {
			log("Main", color.red + "invalid JSON data received: " + err);
		}

		console.log("connection closed");
	});

});

server.listen(config.port ? config.port : 9502, function() {
	log("Main", "iSpindel-Forwarder listening on port " + server.address().port);
});

function forwardCraftbeerpi3(forwarder) {
	var rec = forwarder.buffer[0];
	var data = forwarder.buffer[0].data;

	if (data.type === "eManometer") {
		log(forwarder.type, color.light_red + "Currently eManometer data cannot be forwarded to Craftbeerpi3");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}
	if (forwarder.ip == undefined) {
		log(forwarder.type, color.red + "config error: ip field missing for craftbeerpi3 forwarder");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}

	var url = "http://" + forwarder.ip + "/api/hydrometer/v1/data";

	var data = {
		"name": data.name,
		"angle": forwarder["send-angle"] === true ? data.angle : data.gravity,
		"temperature": data.temperature,
		"battery": data.battery
	};

	log(forwarder.type, "forwarding to craftbeerpi3 at " + url);

	request.post(url, { json: data }, function(error, res, body) {
		if (error) {
			log(forwarder.type, color.red + error)

			forwardCallback(rec, forwarder, forwardReturnVal.Error);
			return
		}

		var success = res.statusCode == 200 || res.statusCode == 204;
		logs(forwarder.type, "returned: " + res.statusCode, success);
		console.log(body);

		if (success)
			forwardCallback(rec, forwarder, forwardReturnVal.Success);
		else
			forwardCallback(rec, forwarder, forwardReturnVal.Error);
	});
}

function forwardUbidots(forwarder) {
	var rec = forwarder.buffer[0];
	var data = forwarder.buffer[0].data;

	var token;
	if (forwarder.token == undefined || forwarder.token == null) {
		token = data.token;
	}
	else {
		token = forwarder.token;
	}

	if (token == undefined || token == null) {
		log(forwarder.type, color.red + "Don't have any ubidots token");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}

	var url = "http://things.ubidots.com/api/v1.6/devices/" + data.name + "?token=" + token;

	var data = {
		"tilt": {
			"value": data.angle,
			"timestamp": data.timestamp
		},
		"temperature": {
			"value": data.temperature,
			"timestamp": data.timestamp
		},
		"battery": {
			"value": data.battery,
			"timestamp": data.timestamp
		},
		"gravity": {
			"value": data.gravity,
			"timestamp": data.timestamp
		},
		"interval": {
			"value": data.interval,
			"timestamp": data.timestamp
		},
		"rssi": {
			"value": data.RSSI,
			"timestamp": data.timestamp
		}
	};

	log(forwarder.type, "forwarding to ubidots at " + url + " (" + forwarder.buffer.length + " in queue)");

	request.post(url, { json: data }, function(error, res, body) {
		if (error) {
			console.error(error)
			forwardCallback(rec, forwarder, forwardReturnVal.Buffer);
			return
		}
		log(forwarder.type, "returned: " + res.statusCode, res.statusCode == 200);
		console.log(body);
		forwardCallback(rec, forwarder, res.statusCode == 200 ? forwardReturnVal.Success : forwardReturnVal.Error);
	});

}

function forwardGenericTCP(forwarder) {
	var rec = forwarder.buffer[0];
	var data = forwarder.buffer[0].data;

	if (forwarder.ip == undefined) {
		log(forwarder.type, color.red + "config error for iSpindel TCP server: missing ip field");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}
	if (forwarder.port == undefined) {
		log(forwarder.type, color.red + "config error for generic TCP server: missing port field");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}

	log(forwarder.type, "forwarding to generic TCP Server " + forwarder.ip + ":" + forwarder.port + " (" + forwarder.buffer.length + " in queue)");

	var sock = new net.Socket();
	sock.setTimeout(5000);

	sock.on('error', function(err) {
		log(forwarder.type, color.red + "error connecting to " + forwarder.ip + ":" + forwarder.port + ": " + err);
		forwardCallback(rec, forwarder, forwardReturnVal.Buffer);
	});

	sock.connect(forwarder.port, forwarder.ip, function() {
		sock.write(JSON.stringify(data), function() {
		});
	});

	sock.on('close', function(hadErr) {
		logs(forwarder.type, "socket closed", !hadErr);
		forwardCallback(rec, forwarder, hadErr ? forwardReturnVal.Buffer : forwardReturnVal.Success);
	})

	sock.on('timeout', function() {
		forwardCallback(rec, forwarder, forwardReturnVal.Buffer);
		log(forwarder.type, color.light_red + "Timeout waiting for reply");
		sock.end();
	});

	sock.on('data', function(data) {
		if (data == String.fromCharCode(6)) {
			log(forwarder.type, "received ACK");
			forwardCallback(rec, forwarder, forwardReturnVal.Success);
		}
		else if (data == String.fromCharCode(21)) {
			log(forwarder.type, color.red + "received NACK, dropping data");
			forwardCallback(rec, forwarder, forwardReturnVal.Error);
		}
		else {
			log(forwarder.type, color.red + "invalid reply received from generic TCP Server");
			forwardCallback(rec, forwarder, forwardReturnVal.Error);
		}
	});
}

function forwardThingspeak(forwarder) {
	var rec = forwarder.buffer[0];
	var data = forwarder.buffer[0].data;

	if (forwarder.token == undefined || forwarder.token == null) {
		log(forwarder.type, color.red + "Config error: missing token");
		forwardCallback(rec, forwarder, forwardReturnVal.Error);
		return;
	}

	var url = "http://api.thingspeak.com/update";

	var outdata = {};

	/* Helper function to add a field if it exists in the data and if it's defined in the config */
	var addField = function(fieldname) {
		var num = forwarder['field-' + fieldname];

		if (data[fieldname] && num && num > 0 && num <= 8) {
			outdata["field" + num] = data[fieldname];
		}
	};

	addField('gravity');
	addField('temperature');
	addField('angle');
	addField('battery');
	addField('rssi');
	addField('interval');
	addField('pressure');
	addField('co2');

	outdata['api_key'] = forwarder.token;
	outdata['created_at'] = new Date(data.timestamp).toISOString();

	var str = querystring.stringify(outdata);

	request.get(url + "?" + str, function(error, res, body) {
		if (error) {
			console.error(error)
			forwardCallback(rec, forwarder, forwardReturnVal.Buffer);
			return
		}
		log(forwarder.type, "returned: " + res.statusCode, res.statusCode == 200);
		console.log(body);
		forwardCallback(rec, forwarder, res.statusCode == 200 ? forwardReturnVal.Success : forwardReturnVal.Error);
	});
}

function forwardCallback(data, forwarder, retval)
{
	if (data.invoked) {
		return;
	}

	data.invoked = true;

	if (retval == forwardReturnVal.Success) {
		logs(forwarder.type, "successfully forwarded", true);
		forwarder.buffer.shift();
	}
	else if (retval == forwardReturnVal.Error) {
		log(forwarder.type, color.red + "error during forwarding, but not buffering");
		forwarder.buffer.shift();
	}
	else if (retval == forwardReturnVal.Buffer) {
		log(forwarder.type, color.light_red + "error during forwarding, buffered to be sent later");
	}

	if (forwarder.buffer.length > 0) {
		if (retval == forwardReturnVal.Success)
			forwardData(forwarder);
		else
			setTimeout(function() {
				forwardData(forwarder);
			}, 3000);
	}
	
}

function forwardData(forwarder) {
	log("Main", "forwarding to " + forwarder.type);

	forwarder.buffer[0].invoked = false;

	switch(forwarder.type) {
		case "craftbeerpi3":
			forwardCraftbeerpi3(forwarder);
			break;

		case "ubidots":
			forwardUbidots(forwarder);
			break;

		case "generic-tcp":
			forwardGenericTCP(forwarder);
			break;

		case "thingspeak":
			forwardThingspeak(forwarder);
			break;
	}
}

function handleData(data) {
	if (data.ID == undefined) {
		log("Main", color.red + "invalid json data (missing id)");
		return;
	}
	if (data.name == undefined) {
		log("Main", color.red + "invalid json data (missing name)");
		return;
	}

	log("Main", "got data " + JSON.stringify(data));

	if (config.devices[data.name] == undefined || config.devices[data.name].forwarders == undefined) {
		log("Main", color.light_red + "no forwarders defined for device " + data.name);
		return;
	}

	if (data.timestamp == undefined)
		data.timestamp = Date.now();

	for (var i = 0; i < config.devices[data.name].forwarders.length; ++i) {
		var forwarder = config.devices[data.name].forwarders[i];

		if (forwarder.buffer == undefined)
			forwarder.buffer = new Array;

		forwarder.buffer.push( {
			'invoked' : false,
			'data': data
		});

		if (forwarder.buffer.length == 1)
			forwardData(forwarder);
	}

}
