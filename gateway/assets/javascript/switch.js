// A factory function to update status only when there is no pending request
let pending = 0;

var taskup = function() {
	pending++;
};

function done(jsObj) {
	if ( --pending === 0 ) {
		if (jsObj) {
			for (var key in jsObj){
				document.getElementById(key).checked = jsObj[key];
			}
		}
	}
};

// Check state of switches as a json string
document.getElementById("checkval").addEventListener("click", function(event) {    
    var url = serverAddr;
    var xmlHttp = new XMLHttpRequest();

    var reqData = {};
    reqData["method"] = "state";
    reqData["device"] = deviceName;
    data = JSON.stringify(reqData);

    xmlHttp.onreadystatechange = function() {
	if (this.readyState == 4 && this.status == 200) {
		var jsObj = JSON.parse(this.responseText);
		let data = JSON.stringify(jsObj[deviceName], null, 4)
    		alert(data);
	} else if (this.readyState == 4 && this.status != 200) {
		alert("Failed to get state from : " + url);
	} else {
	}
    };
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader('token', apiToken);
    xmlHttp.setRequestHeader('accept', "application/json");
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.send(data);
});

// Check if any switch state has changed
document.getElementsByName("switch").forEach(function(elem) {
    elem.addEventListener("click", function(event) {
	    switchId = elem.getAttribute("id");
	    taskup();

	    var initialVal = !elem.checked
      	    var value = elem.checked?'enable':'disable';
	    var url = serverAddr;
	    
	    var reqData = {}
	    reqData["socket"] = switchId;
	    reqData["method"] = value;
	    reqData["device"] = deviceName;
	    let data = JSON.stringify(reqData);

	    var xmlHttp = new XMLHttpRequest();
	    xmlHttp.onreadystatechange = function() {
		if (this.readyState == 4) {
		     if (this.status != 200) {
		     	 done();
			 document.getElementById(switchId).checked = initialVal;
		         console.log("Failed to change switch state from : " + (initialVal?"enable":"disable"));
		     } else {
			 var myObj = JSON.parse(this.responseText);
		     	 done(myObj);
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


// Update switch state autometically in every 10 sec
setInterval(function() {
    var url = serverAddr;
    var xmlHttp = new XMLHttpRequest();
    var reqData = {};
    reqData["method"] = "state";
    let data = JSON.stringify(reqData);

    xmlHttp.onreadystatechange = function() {
	if (this.readyState == 4 && this.status == 200) {
		var myObj = JSON.parse(this.responseText);
		var jsObj = myObj[deviceName];
		// Update only when no pending task
		if (pending === 0 ) {
			for (var key in jsObj){
				document.getElementById(key).checked = jsObj[key];
			}
		}
	} else if (this.readyState == 4 && this.status != 200) {
		console.log("Failed to get state from : " + url);
	} else {
	}
    };
    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader('token', apiToken);
    xmlHttp.setRequestHeader('accept', "application/json");
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.send(data);
}, 10000);
