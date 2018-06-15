// A factory function to update status only when there is no pending request

let pending = {};

var taskup = function(deviceId) {
    if (!(deviceId in pending)) {
        pending[deviceId] = 0;
    }
    pending[deviceId]++;
};

function done(jsObj, deviceId) {
    if (pending[deviceId]-- === 0) {
    	console.log("status update")
        if (jsObj) {
            for (var switchkey in jsObj) {
                var switchId = switchkey + "@" + deviceId;
                document.getElementById(switchId).checked = jsObj[switchkey];
            }
        }
    }
};

// Get the server address
function getServer() {
    var server = "";
    if (serverAddr != "") {
        server = serverAddr;
    } else {
        var protocol = location.protocol;
        var slashes = protocol.concat("//");
        server = slashes.concat(window.location.hostname);
        server = server.concat("/function/diot-gateway");
    }
    return server;
};


// Show/Hide Menu Item 
document.getElementById("menu").addEventListener("click", function(event) {
    var list = document.getElementById("menuItem");
    //console.log
    if (list.style.visibility == 'hidden') {
          document.getElementsByName("item").forEach(function(elem) {
            elem.style.animation='rolldown .7s 1';
            elem.style.visibility='visible';
          }); 
	  // Hide the background item
	  document.getElementsByName("deviceContainer").forEach(function(dc) {
	    // Only do for current visible item
	    if (dc.style.visibility == 'visible') {
            	dc.style.opacity=0.4;
	    }
          });
          list.style.visibility='visible';
    } else {
        document.getElementsByName("item").forEach(function(elem) {
          elem.style.animation='rollup .4s 1';
          elem.style.visibility='hidden';
        });
	// Make the background item visible 
	document.getElementsByName("deviceContainer").forEach(function(dc) {
	    // Only do for current visible item
	    if (dc.style.visibility == 'visible') {
            	dc.style.opacity=0.95;
	    }
        });
        list.style.visibility='hidden';
    }
});

// Menu Item Handler
document.getElementsByName("item").forEach( function(elem) {
   var list = document.getElementById("menuItem");
   elem.style.visibility='hidden';
   list.style.visibility='hidden';
   elem.addEventListener("click", function(event) {
      // Handle Click
      var value = elem.getAttribute("value");
      console.log("click on " + value)

      // Hide list
      document.getElementsByName("item").forEach(function(elem) {
          elem.style.animation='rollup .5s 1';
          elem.style.visibility='hidden';
      });
      list.style.visibility='hidden';

      // Do value specific Operation
      if (value == "logout") {
    	document.cookie = "diottoken=invalid";
    	document.location.reload();
      } else {
          document.getElementsByName("deviceContainer").forEach(function(elem) {
            elem.style.visibility='hidden';
          });
          var containerId = "container@" + value;
          document.getElementById(containerId).style.visibility='visible';
	  // Make the selected item visible
	  document.getElementById(containerId).style.opacity=0.95;
      }
   });
});

// Initially all container are invisible
document.getElementsByName("deviceContainer").forEach(
	function(elem) {
		elem.style.visibility='hidden';
	}
);

// Make the First item visible
document.getElementsByName("deviceContainer")[0].style.visibility='visible';

// Check if any device status has changed
document.getElementsByName("status").forEach(function(elem) {
    elem.addEventListener("click", function(event) {
        deviceId = elem.getAttribute("id");
        taskup(deviceId);

        var initialVal = !elem.checked;
        var value = elem.checked ? 'enable' : 'disable';
        var url = getServer();

        var reqData = {};
        reqData["value"] = 'all';
        reqData["method"] = value;
        reqData["device"] = deviceId;
        let data = JSON.stringify(reqData);

        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (this.readyState == 4) {
                if (this.status != 200) {
                    done();
                    document.getElementById(deviceId).checked = initialVal;
                    console.log("Failed to change device state from : " + (initialVal ? "active" : "disable"));
                } else {
                    var myObj = JSON.parse(this.responseText);
                    done(myObj, deviceId);
                }
            }
        };
        xmlHttp.open("POST", url, true);
        xmlHttp.setRequestHeader('token', apiToken);
        xmlHttp.setRequestHeader('accept', "application/json");
        xmlHttp.setRequestHeader("Content-Type", "application/json");
        xmlHttp.send(data);
	document.getElementsByName("switch").forEach(function(selem) {
		var switchId = selem.getAttribute("id");
		var splits = switchId.split("@");
        	var deviceName = splits[1];
		if (deviceName == deviceId) {
			selem.checked = elem.checked;
		}
	});
    });
});


// Check if any switch state has changed
document.getElementsByName("switch").forEach(function(elem) {
    elem.addEventListener("click", function(event) {
        var switchId = elem.getAttribute("id");
        var splits = switchId.split("@");
        var switchName = splits[0];
        var deviceName = splits[1];

        taskup(deviceName);

        var initialVal = !elem.checked;
        var method = elem.checked ? 'enable' : 'disable';
        var url = getServer();

        var reqData = {};
        reqData["value"] = switchName;
        reqData["method"] = method;
        reqData["device"] = deviceName;
        let data = JSON.stringify(reqData);

        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (this.readyState == 4) {
                if (this.status != 200) {
                    done();
                    document.getElementById(switchId).checked = initialVal;
                    console.log("Failed to change switch state from : " + (initialVal ? "enable" : "disable"));
                } else {
                    // Set the device status is enabled
                    document.getElementById(deviceName).checked = true;
                    var myObj = JSON.parse(this.responseText);
                    done(myObj, deviceName);
                }
            }
        };
        xmlHttp.open("POST", url, true);
        xmlHttp.setRequestHeader('token', apiToken);
        xmlHttp.setRequestHeader('accept', "application/json");
        xmlHttp.setRequestHeader("Content-Type", "application/json");
        xmlHttp.send(data);
    });
});

document.getElementsByName("checkval").forEach(function(elem) {
    // Check state of switches and alert as a json string
    elem.addEventListener("click", function checkval(event) {
        var url = getServer();
        var xmlHttp = new XMLHttpRequest();

        var reqData = {};
        reqData["method"] = "state";
        reqData["device"] = elem.value;
        data = JSON.stringify(reqData);

        xmlHttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status != 200) {
                alert("Failed to get state from : " + url);
                return;
            }
            if (this.readyState == 4 && this.status == 200) {
                var jsObj = JSON.parse(this.responseText);
                let data = JSON.stringify(jsObj[elem.value], null, 4);
                alert(data);
            }
        };
        xmlHttp.open("POST", url, true);
        xmlHttp.setRequestHeader('token', apiToken);
        xmlHttp.setRequestHeader('accept', "application/json");
        xmlHttp.setRequestHeader("Content-Type", "application/json");
        xmlHttp.send(data);
    });
});

// Update switch state autometically in every 2 sec
setInterval(function() {
    var url = getServer();
    var xmlHttp = new XMLHttpRequest();
    var reqData = {};
    reqData["method"] = "state";
    let data = JSON.stringify(reqData);

    xmlHttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var myObj = JSON.parse(this.responseText);
            for (var deviceName in myObj) {
                var jsObj = myObj[deviceName];

		if (!(deviceName in pending)) {
			pending[deviceName] = 0;
		}

                // Update only when no pending task
                if (pending[deviceName] === 0) {
                    for (var switchkey in jsObj) {
                        var switchId = switchkey + "@" + deviceName;
                        document.getElementById(switchId).checked = jsObj[switchkey];
                    }
                }
            }
        } else if (this.readyState == 4 && this.status != 200) {
            console.log("Failed to get state from : " + url);
        } else {}
    };
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader('token', apiToken);
    xmlHttp.setRequestHeader('accept', "application/json");
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.send(data);
}, 2000);
