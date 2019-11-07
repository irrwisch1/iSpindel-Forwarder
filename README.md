# iSpindel-Forwarder

This is a simple tool to buffer & forward iSpindel & eManometer data to various
services like

- Local iSpindel Server
- Ubidots
- CraftBeerPi3
- and more to come

It can be configured very flexibly so that data from different iSpindels / eManometers
can be forwarded to different services, i.e. different CraftBeerPi instances.

Please see the example-config.json as a reference.

Another thing this daemon does is buffering data from the iSpindel / eManometer if the
internet connection is dead.

(Note: If you want to use the buffering feature with the local iSpindel Server you currently
have to use my fork of the local iSpindel server, to allow the timestamp to be transmitted 
over the network rather than beeing generated by the server script itself)

Some use cases:
- It allows you to very flexibly change were you want your iSpindel data to be sent
without having to reconfigure your iSpindel every time.
- Imagine you fermantation chamber doesn't have an internet and is relying on a very
flaky 3G/LTE connection to send it's data to the internet (Like in my case).  The connection 
sometimes drops or is very slow so that the iSpindel runs quickly into timeouts while trying
to transmit the data (presumely to save battery power).
This script can act as a relay for the iSpindel. Running for example on an Raspi in 
the same local network as your iSpindel this script will buffer the data from the iSpindel
and send it out once the internet connection is back again.

# Configuration

Here is an example configuration

	{
		/* The port number the script will listen to */
		"port": 9502,

		/* Array of devices. Just add an entry for each device */
		"devices": {
			/* The name of the object must match the name that is transmitted 
				by the iSpindel / eManometer
				type can be "iSpindel" or "eManometer" */
			"iSpindel000": {
				"type": "iSpindel",
				/* An array of forwarders for this device. Multiple forwarders of the
					same type can be defined and each forwarder will be buffered
					individually
				*/
				"forwarders": [
					{
						/* Forward to CraftbeerPi3. You need the iSpindel module for craftbeer installed */
						"type": "craftbeerpi3",
						"ip": "192.168.0.52",

						/* Send the angle instead of the tilt. If you want to configure the polynom from
						within Cbpi3 than set this to true. Most people will want this to be false */
						"send-angle": false
					},
					{
						/* Forward to ubidots */
						"type": "ubidots",
						/* API key */
						"token": "xxxx"
					},
					{
						/* generic-tcp is to forward to the local iSpindel-TCP Server or another instance of
						this script
						*/
						"type": "generic-tcp",
						"ip": "192.168.0.52",
						"port": 9501
					},
					{
						/* Forward to thingspeak */
						"type": "thingspeak",

						/* API key for the channel */
						"token": "abcdef",

						/* You need to define fields for the specific items. If an item is missing or set the
						null than it won't be transmitted to thingspeak */
						"field-gravity": 0,
						"field-temperature": 1,
						"field-angle": 2,
						"field-battery": null,
						"field-rssi": null,
						"field-"
					}
				]
			},
			"eManometer000": {
				"type": "eManometer",
				"forwarders": [
					{
						"type": "generic-tcp",
						"ip": "192.168.0.52",
						"port": 9501
					},
					{
						"type": "thingspeak",
						"token": "abcdef",
						"field-temperature": 0,
						"field-co2": 1,
						"field-pressure": 2
					}
				]
			}
		}
	}
