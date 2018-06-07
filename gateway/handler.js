"use strict"

const htmlType = "text/html";
const jsonContent = "application/json"
const request = require('request');
const cookie = require('cookie');
const pug = require('pug');
const path = require('path');
const consul = require('consul')({
    host: "registry_consul"
});

// Main Handle
module.exports = (event, context) => {

    // Check if UI request
    if (event.headers.accept.includes("html")) {

        var loginRequest = true;
        var cookies = null;

        // if cookie exist check value 
        if (event.headers.cookie) {
            cookies = cookie.parse(event.headers.cookie);
            if (cookies.diottoken == process.env.api_token) {
                loginRequest = false;
            } else {
                console.log("invalid Cookie token provided, " + event.headers.token);
            }
        }

        // Check if a valid login request
        if (loginRequest) {
            return loginPageHandle(context, event);
        } else {
            return profilePageHandle(context, event, cookies.diottoken);
        }
    }

    // If API request
    if (event.headers.accept.includes("json") && event.body.method &&
        event.body.method != "") {

        console.log("method: " + event.body.method);

        // check if the requested method is login
        if (event.body.method == "login") {
            return loginRequestHandle(context, event);
        }

        // for other request we need to validate the auth_token
        if (event.headers.token == process.env.api_token) {

            // ENABLE/DISABLE
            if ((event.body.method == 'enable' || event.body.method == 'disable') &&
                event.body.socket && event.body.device) {
                return socketRequestHandle(context, event);
            }
            // STATE
            if (event.body.method == "state") {
                return stateRequestHandle(context, event);
            }

            // DEVICE Register
            if (event.body.method == "register") {
                return registerRequestHandle(context, event);
            }

        } else {
            console.log("invalid API token provided, " + event.headers.token);
            return context.fail("no Resource Found");
        }
    }

    console.log("invalid Request, detailes: ");
    console.log(event.headers);
    console.log(event.body);

    return context.fail("no Resource Found");
};


var compiledFunction = null;

// HTML Request Handler:

function loginPageHandle(context, event) {
    var buildObj = {};

    var compiledFunction = pug.compileFile('./function/assets/login.pug');
    // this url is used by the server to send async request
    buildObj['publicUrl'] = process.env.gateway_public_uri;
    var resp = compiledFunction({
        source: buildObj
    });
    return context
        .status(200)
        .headers({
            "Content-Type": htmlType
        })
        .succeed(resp);
};

function profilePageHandle(context, event) {
    compiledFunction = pug.compileFile('./function/assets/index.pug');

    var user = process.env.username;
    var token = process.env.api_token;
    var deviceObject = {};

    // all devices
    deviceObject['devices'] = {};

    let deviceAddr = {};
    var done = false;

    consul.kv.keys("diot/devices/", function(derr, result) {
        if (derr) {
            console.log("failed to retrive devices info, error: ", derr);
            return;
        }
	console.log(result);

        result.forEach(function(device) {
	    var basename = path.basename("/" + device);
	    console.log(basename);
            if (basename != "address") {
                return;
            }
            let devicePath = path.dirname("/" + device);
            let deviceName = devicePath.split(path.sep).pop();
            consul.kv.get(devicePath + "/address", function(adrerr, result) {
                if (adrerr) {
                    console.log("failed to retrive devices address info, error: ", adrerr);
                    return;
                }
                deviceAddr[deviceName] = result.Value;
            });
        });
	
	done = true;
    });

    while (!done) {}

    console.log(deviceAddr);

    Object.keys(deviceAddr).forEach(function(device) {
        let deviceUrl = deviceAddr[device];
        deviceUrl = deviceUrl + "/skill/switch/state/all";
        const req = {
            uri: deviceUrl,
            timeout: 120, // 2 sec of timeout 
        };
        request.get(req, (err, res, body) => {
            if (err) {
                console.log("failed to request device: " + err);
                body = "";
            }
            var deviceProp = {};
            try {
                deviceProp['switches'] = JSON.parse(body);
                deviceProp['state'] = true;
            } catch (error) {
                console.log("failed to parse device response, " + error.message);
                deviceProp['switches'] = {};
                deviceProp['state'] = false;
            }
            deviceObject['devices'][device] = deviceProp;
        });
    });

    deviceObject['publicUrl'] = process.env.gateway_public_uri;
    deviceObject['apiToken'] = token;
    console.log(deviceObject);

    var resp = compiledFunction({
        source: deviceObject
    });

    return context
        .status(200)
        .headers({
            "Content-Type": htmlType
        })
        .succeed(resp);
};

// API Request Handler:  

function loginRequestHandle(context, event) {
    var user = event.body.username;
    var pass = event.body.password;
    // TODO: Later it will be generated for each user on login 
    var token = process.env.api_token;
    if (user == process.env.username && pass == process.env.password) {
        return context
            .status(200)
            .headers({
                "Content-Type": jsonContent
            })
            .headers({
                "diotcookie": "diottoken=" + token
            })
            .succeed("");
    }
    console.log("Invalid User and Password : " + user + ", " + pass);
    return context.fail("Login Failed");
};

function socketRequestHandle(context, event) {
    // TODO: Get mapped deviceURL for the requested device 
    let deviceUrl = process.env.device_url;
    if (!deviceUrl.length) {
        console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
        return context.fail("internal error: invalid deviceUrl");
    }
    deviceUrl = deviceUrl + "/skill/switch/" + event.body.method + "/" + event.body.socket;
    const req = {
        uri: deviceUrl,
        timeout: 60, // 1 sec of timeout 
    };
    return request.get(req, (err, res, body) => {
        if (err) {
            console.log("failed to request device: " + err);
            return context.fail("failed to request device: " + err);
        }
        return context
            .status(200)
            .headers({
                "Content-Type": jsonContent
            })
            .succeed(body);
    });
};

function stateRequestHandle(context, event) {
    let allState = {};
    let deviceAddr = {};

    if (event.body.device) {
        consul.kv.get("diot/devices/" + event.body.device + "/address", function(adrerr, result) {
            if (adrerr) {
                console.log("failed to retrive devices address info, error: ", adrerr);
                return;
            }
            deviceAddr[event.body.device] = result.Value;
        });
    } else {
        consul.kv.keys("diot/devices/", function(derr, result) {
            if (derr) {
                console.log("failed to retrive devices info, error: ", derr);
                return;
            }
            result.forEach(function(device) {
                if (path.basename(device) != "address") {
                    return;
                }
                let devicePath = path.dirname(device);
                let deviceName = path.dirname(device).split(path.sep).pop();
                consul.kv.get(devicePath + "/address", function(adrerr, result) {
                    if (adrerr) {
                        console.log("failed to retrive devices address info, error: ", adrerr);
                        return;
                    }
                    deviceAddr[deviceName] = result.Value;
                });
            });
        });

    }

    Object.keys(deviceAddr).forEach(function(device) {
        let deviceUrl = deviceAddr[device];
        if (!deviceUrl.length) {
            console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
            return context.fail("internal error: invalid deviceUrl");
        }
        deviceUrl = deviceUrl + "/skill/switch/state/all";
        const req = {
            uri: deviceUrl,
            timeout: 60, // 1 sec of timeout 
        };

        return request.get(req, (err, res, body) => {
            if (err) {
                console.log("failed to request device, error: " + err);
            }
            try {
                const jsObj = JSON.parse(body);
                allState[device] = jsObj;
            } catch (error) {
                allState[device] = {};
            }
        });
    });

    let data = JSON.stringify(allState);
    return context
        .status(200)
        .headers({
            "Content-Type": jsonContent
        })
        .succeed(data);
};

function registerRequestHandle(context, event) {

    var deviceid = event.body.deviceid;
    var skills = event.body.skills;
    var deviceaddr = event.body.deviceaddr;

    let devicepath = "diot/devices/" + deviceid

    consul.kv.set(devicepath + "/skills", skills, function(err, result) {
        if (err) {
            console.log("failed to register device skill, error: " + err);
            return context.fail("failed to register device skill, error: " + err);
        }
    });

    consul.kv.set(devicepath + "/address", deviceaddr, function(err, result) {
        if (err) {
            console.log("failed to register device address, error: " + err);
            return context.fail("failed to register device skill, error : " + err);
        }
    });


    // Get device address
    context
        .status(200)
        .headers({
            "Content-Type": jsonContent
        })
        .succeed("");
};
