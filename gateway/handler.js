"use strict"

const htmlType = "text/html";
const jsonContent = "application/json"
const request = require('request');
const cookie = require('cookie');
const pug = require('pug');


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

        } else {
            console.log("invalid API token provided, " + event.headers.token);
            return context.fail("no Resource Found");
        }
    }

    console.log("invalid Request, " + event.headers + event.body);
    return context.fail("no Resource Found");
};


var compiledFunction = null;

// HTML Request Handler:

function loginPageHandle(context, event) {
    var buildObj = {};
    
    var compiledFunction = pug.compileFile('./function/assets/login.pug');
    // this url is used by the server to send async request
    buildObj['publicUrl'] = process.env.gateway_public_url;
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

var pendingDevice = 0;
var deviceObject = {};
function devDone(context, user, token, device, resp) {
    var deviceProp = {};

    try {
        deviceProp['switches'] = JSON.parse(body);
        deviceProp['state'] = true;
    } catch (error) {
        deviceProp['switches'] = {};
        deviceProp['state'] = false;
    }
    deviceObject['devices'][device] = deviceProp;

    if (--pendingDevice === 0) {
        deviceObject['publicUrl'] = process.env.gateway_public_url;
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
    }
};

function profilePageHandle(context, event) {
    compiledFunction = pug.compileFile('./function/assets/index.pug');

    var user = process.env.username;
    var token = process.env.api_token;

    // total No of device
    pendingDevice = 1;
    deviceObject['devices'] = {};

    // TODO: For each device {}
    var device = process.env.device_name;
    let deviceUrl = process.env.device_url;

    if (!deviceUrl.length) {
        console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
        return context.fail("internal error: invalid deviceUrl");
    }
    deviceUrl = deviceUrl + "/state?socket=all";
    const req = {
        uri: deviceUrl,
    };

    return request.get(req, (err, res, body) => {
        if (err) {
            console.log("failed to request device: " + err);
            devDone(context, user, token, device, "");
        } else {
            devDone(context, user, token, device, body);
        }
    });
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
    deviceUrl = deviceUrl + "/" + event.body.method + "?socket=" + event.body.socket;
    const req = {
        uri: deviceUrl,
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
    if (!deviceUrl.length) {
        console.log("error, invalid device address: rasp_ctl url: " + deviceUrl);
        return context.fail("internal error: invalid deviceUrl");
    }
    deviceUrl = deviceUrl + "/state";
    const req = {
        uri: deviceUrl,
    };
    return request.get(req, (err, res, body) => {
        if (err) {
            console.log("failed to request device: " + err);
            return context.fail("failed to request device: " + err);
        }
        const jsObj = JSON.parse(body);
        allState[device] = jsObj
        let data = JSON.stringify(allState);
        return context
            .status(200)
            .headers({
                "Content-Type": jsonContent
            })
            .succeed(data);
    });
};
