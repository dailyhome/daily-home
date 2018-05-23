"use strict"

const fs = require('fs');
const contentType = "application/json; charset=utf-8";
const request = require('request');

module.exports = (event, context) => {

    if (event.body.session.application.applicationId != process.env.alexa_app_id) {

	    console.log('error, invalid request model');
	    return context.fail("internal error - invalid request");

    } else if(event.body.request.type == "LaunchRequest") {

		return launchRequest(context);

    } else {

	    // Other request type
	    fs.readFile("./function/response.json", "utf8", (err, val) => {

		if(err) {
		    return context.fail(err);
		}

		const response = JSON.parse(val);

		let url = process.env.device_url;

		if(!url || !url.length)  {
			response.response.outputSpeech.text = "I have an invalid device address!";
			console.log("error, invalid device address: rasp_ctl url: " + url);
			return context
			     .status(200)
			     .headers({"Content-Type": contentType})
			     .succeed(response);
		}


		if(event.body.request.intent && event.body.request.intent.name == "status") {
			url = url + "/state?socket=all";

			const req = {
				uri: url,
			};

			request.get(req, (err, res, body) => {
				if(err) {
					response.response.outputSpeech.text = "I'm having trouble to reach the device ..." + err;
					return context
					      .status(200)
					      .headers({"Content-Type": contentType})
					      .succeed(response);
				}

				const jsonmap = JSON.parse(body);
				
				const ENABLE = "enable";
				const DISABLE = "disable";

				var map = {};
				map[ENABLE] = [];
				map[DISABLE] = [];
				for (var key in jsonmap) {
					var value = jsonmap[key], state = DISABLE;
					if (value) {
						state = ENABLE;
					}
					map[state].push(key);
				}

				var resp = "";
				if (map[ENABLE].length == 0) {
					resp = "All of the switches are disabled !";
				} else if (map[DISABLE].length == 0) {
					resp = "All of the switches are enabled !";
				} else {
					resp = "switch ";
					var socketstr = "";
					var nounce = "are";
					map[ENABLE].forEach(function(value) {
						socketstr += value + ", ";
					});
					if (map[ENABLE].length == 1) {
						nounce = "is";
					}
					resp = resp + socketstr +  nounce + ' enabled, and switch ';
					socketstr = "";
					nounce = "are";
					map[DISABLE].forEach(function(value) {
						socketstr += value + ", ";
					});
					if (map[DISABLE].length == 1) {
						nounce = "is";
					}
					resp = resp + socketstr + nounce + ' disabled !';
				}

				response.response.outputSpeech.text = resp;

				return context
					.status(200)
					.headers({"Content-Type": contentType})
					.succeed(response);
			});

		} else if (event.body.request.intent && event.body.request.intent.name == "enable"
			&& event.body.request.intent.slots
			&& event.body.request.intent.slots.socket) {

			if (!event.body.request.intent.slots.socket.value){
				response.response.outputSpeech.text = "please try again with a switch value from 1 to 8 or all";
				response.response.shouldEndSession = false;
				return context
				      .status(200)
				      .headers({"Content-Type": contentType})
				      .succeed(response);
			}

			if (!(event.body.request.intent.slots.socket.resolutions.resolutionsPerAuthority[0].hasOwnProperty('values'))) {
				response.response.outputSpeech.text = "Switch " + event.body.request.intent.slots.socket.value + ", doesn't exist!";
				return context
				      .status(200)
				      .headers({"Content-Type": contentType})
				      .succeed(response);
			}
			let socket = event.body.request.intent.slots.socket.resolutions.resolutionsPerAuthority[0].values[0].value.name;

			if (socket == "0") {
				socket = "all";
			}

			url = url + "/enable?socket=" + socket;
			const req = {
				uri: url,
			};

			request.get(req, (err, res, body) => {
				if(err) {
					response.response.outputSpeech.text = "I'm having trouble to reach the device ..." + err;
					return context
					      .status(200)
					      .headers({"Content-Type": contentType})
					      .succeed(response);
				}

				const jsonmap = JSON.parse(body);

				var resp = "";
				if (jsonmap[socket]) {
					resp = "Switch " + socket + ", is enabled !";
				} else if (socket == "all") {
					resp = "All switches are enabled !";
				} else {
					resp = "Failed to enable switch " + socket + "! Some error occured in device ...";
				}

				response.response.outputSpeech.text = resp;

				return context
					.status(200)
					.headers({"Content-Type": contentType})
					.succeed(response);
			});

		} else if (event.body.request.intent && event.body.request.intent.name == "disable"
			&& event.body.request.intent.slots
			&& event.body.request.intent.slots.socket) {

			if (!event.body.request.intent.slots.socket.value){
				response.response.outputSpeech.text = "please try again with a switch value from 1 to 8 or all";
				response.response.shouldEndSession = false;
				return context
				      .status(200)
				      .headers({"Content-Type": contentType})
				      .succeed(response);
			}

			if (!(event.body.request.intent.slots.socket.resolutions.resolutionsPerAuthority[0].hasOwnProperty('values'))) {
				response.response.outputSpeech.text = "Switch " + event.body.request.intent.slots.socket.value + ", doesn't exist!";
				return context
				      .status(200)
				      .headers({"Content-Type": contentType})
				      .succeed(response);
			}

			let socket = event.body.request.intent.slots.socket.resolutions.resolutionsPerAuthority[0].values[0].value.name;

			if (socket == "0") {
				socket = "all";
			}

			url = url + "/disable?socket=" + socket;
			const req = {
				uri: url,
			};

			request.get(req, (err, res, body) => {
				if(err) {
					response.response.outputSpeech.text = "I'm having trouble to reach the device ..." + err;
					return context
					      .status(200)
					      .headers({"Content-Type": contentType})
					      .succeed(response);
				}

				const jsonmap = JSON.parse(body);

				var resp = "";
				if (jsonmap[socket] == false) {
					resp = "Switch " + socket + ", is disabled !";
				} else if (socket == "all") {
					resp = "All switches are disabled !";
				} else {
					resp = "Failed to disable switch " + socket + "! Some error occured in device ...";
				}

				response.response.outputSpeech.text = resp;

				return context
					.status(200)
					.headers({"Content-Type": contentType})
					.succeed(response);
			});

		} else if (event.body.request.intent && event.body.request.intent.name == "reset")  {
			response.response.outputSpeech.text = event.body.request.intent.name + " is not yet implemented!"; 
			context
			    .status(200)
			    .headers({"Content-Type": contentType})
			    .succeed(response);
		} else {
			response.response.outputSpeech.text = "I dont know what you just said, you can ask to enable and disable switch or just ask for status!"; 
			context
			    .status(200)
			    .headers({"Content-Type": contentType})
			    .succeed(response);
		}
	    });
    }
}

let launchRequest = (context) => {
    fs.readFile("./function/response.json", "utf8", (err, val) => {
        if(err) {
            return context.fail(err);
        }
    
        const response = JSON.parse(val);
        response.response.outputSpeech.type = "SSML";
        response.response.shouldEndSession = false;

        context
            .status(200)
            .headers({"Content-Type": contentType})
            .succeed(response);
    });
};
