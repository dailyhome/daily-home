// If serverAddr is specified use it otherwise get the host
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

// Listen for login button press and on clieck perform login
function loginRequest() {
    var url = getServer();
    var xmlHttp = new XMLHttpRequest();

    var reqData = {};
    reqData["method"] = "login";
    reqData["username"] = document.getElementById("username").value;
    reqData["password"] = document.getElementById("password").value;
    if (reqData["username"] == "" || reqData["password"] == "") {
        alert("Username and Password can't be blank !");
        return;
    }

    data = JSON.stringify(reqData);
    xmlHttp.onreadystatechange = function() {

        if (this.readyState == 4 && this.status != 200) {
            alert("Invalid Username or Password !");
            return;
        }

        if (this.readyState == 4 && this.status == 200) {
            console.log(this.getResponseHeader('diotcookie'));
            document.cookie = this.getResponseHeader('diotcookie');
            document.location.reload();
        }
    };

    xmlHttp.open("POST", url, true);
    xmlHttp.setRequestHeader('accept', "application/json");
    xmlHttp.setRequestHeader("Content-Type", "application/json");
    xmlHttp.send(data);
};

document.getElementById("login").addEventListener("click", loginRequest);

