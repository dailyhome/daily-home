"use strict"

const contentType = "text/html"
const request = require('request');

module.exports = (event, context) => {

    // Check if UI request
    if (event.headers.accept.includes("html")) {
	    var pug = require('pug');
	    const compiledFunction = pug.compileFile('./function/assets/index.pug');

	    let deviceUrl = process.env.device_url;
	    if(!deviceUrl.length)  {
		    console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
		    return context.fail("internal error: invalid deviceUrl");
	    }
            deviceUrl = deviceUrl + "/state?socket=all";
            const req = {
		    uri: deviceUrl,
            };
		    
	    return request.get(req, (err, res, body) => {
			if(err) {
				console.log("failed to request device: " + err);
				return context.fail("failed to request device: " + err);
			}
		    	var buildObj = {}
			buildObj['jsonMap'] = JSON.parse(body);
		        // this url is used by the server to send async request
		        buildObj['publicUrl'] = process.env.gateway_public_url;
		        // this key is used by the server to verify request authenticity
		        // TODO: Later it will be generated for each user on login 
		        buildObj['apiToken'] = process.env.api_token;
		        // TODO: Name will be generated based on registered devices
		        buildObj['deviceName'] = process.env.device_name;
		        var resp = compiledFunction({source: buildObj});
		    	return context
		    		.status(200)
		    		.headers({"Content-Type": contentType})
		    		.succeed(resp);
	    });
    } else if (event.headers.accept.includes("json")) {

	    if (event.headers.token != process.env.api_token) {
		  console.log("Invalid API token provided :" + event.headers.token);
		  return context.fail("Access Denied");
	    }

	    if ((event.body.method == 'enable' 
		    || event.body.method == 'disable')
		    && event.body.socket 
		    && event.body.device) {

		    // TODO: Get mapped deviceURL for the requested device 
		    let deviceUrl = process.env.device_url;
		    if(!deviceUrl.length)  {
			    console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
			    return context.fail("internal error: invalid deviceUrl");
		    }
		    deviceUrl = deviceUrl + "/" + event.body.method + "?socket=" + event.body.socket;
		    const req = {
			    uri: deviceUrl,
		    };	    
		    return request.get(req, (err, res, body) => {
				if(err) {
					console.log("failed to request device: " + err);
					return context.fail("failed to request device: " + err);
				}
				return context
					.status(200)
					.headers({"Content-Type": contentType})
					.succeed(body);
		    });

	    } else if (event.body.method == "state") {

	            let allState = {}
		    let device = "";

		    if (event.body.device) {
		    	device = event.body.device;
		    }
		    
		    // TODO: We have only one device now
		    //       later it can be changed to an array
		    if (device == "") {
			    device = process.env.device_name;
		    }

		    // TODO: If device is not specified get state for all device
		    // TODO: Get mapped deviceURL for device 
		    let deviceUrl = process.env.device_url;
		    if(!deviceUrl.length)  {
			    console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
			    return context.fail("internal error: invalid deviceUrl");
		    }
		    deviceUrl = deviceUrl + "/state";
		    const req = {
			    uri: deviceUrl,
		    };	    
		    return request.get(req, (err, res, body) => {
				if(err) {
					console.log("failed to request device: " + err);
					return context.fail("failed to request device: " + err);
				}
			    	const jsObj = JSON.parse(body);
			        allState[device] = jsObj
			        let data = JSON.stringify(allState);
				return context
					.status(200)
					.headers({"Content-Type": contentType})
					.succeed(data);
		    });
	    } else {
		  console.log("Invalid Request :" + event.body);
		  console.log("Method :" + event.body.method);
		  return context.fail("No Resource Found");
	    }
    } else {}
    console.log("Invalid Request :" + event.headers + event.body);
    return context.fail("No Resource Found");
}
