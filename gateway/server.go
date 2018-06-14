package main

import (
	"encoding/json"
	"fmt"
	consulapi "github.com/hashicorp/consul/api"
	pagegen "html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	jsonType = "application/json"
	htmlType = "text/html"

	D_TOKEN         = "just-because-something-doesnt-do-what-you-planned-it-to-do-doesnt-mean-its-useless"
	D_USER          = "admin"
	D_PASS          = "admin"
	D_REGISTRY      = "registry_consul:8500"
	D_REGISTRY_USER = "admin"
	D_REGISTRY_PASS = "admin"
)

var (
	token         = ""
	username      = ""
	password      = ""
	registry      = ""
	registry_user = ""
	registry_pass = ""
	public_uri    = ""

	consul *consulapi.Client = nil
	gen    *pagegen.Template = nil

	static_files = map[string]string{
		"login.js":        "./assets/static/javascript/login.js",
		"profile.js":      "./assets/static/javascript/profile.js",
		"login_style.css": "./assets/static/css/login_style.css",
		"style.css":       "./assets/static/css/style.css",
	}
)

// Universal request object type
type Message struct {
	Method string `json:"method"`

	Value      string   `json:"value"`
	Device     string   `json:"device"`
	DeviceAddr string   `json:"deviceaddr"`
	Skills     []string `json:"skills"`
	Username   string   `json:"username"`
	Password   string   `json:"password"`
}

type Device struct {
	State  bool
	Values map[string]interface{}
}

type HtmlObject struct {
	PublicURL string
	Token     string
	Devices   map[string]*Device
}

// initialize globals
func initialize() error {
	var err error

	public_uri = os.Getenv("gateway_public_uri")
	token = os.Getenv("api_token")
	if token == "" {
		fmt.Printf("using default api-token")
		token = D_TOKEN
	}
	username = os.Getenv("username")
	if username == "" {
		fmt.Printf("using default ")
		username = D_USER
	}
	password = os.Getenv("password")
	if password == "" {
		password = D_PASS
	}
	registry = os.Getenv("registry_addr")
	if registry == "" {
		registry = D_REGISTRY
	}
	registry_user = os.Getenv("registry_user")
	if registry_user == "" {
		registry_user = D_REGISTRY_USER
	}
	registry_pass = os.Getenv("registry_pass")
	if registry_pass == "" {
		registry_pass = D_REGISTRY_PASS
	}

	config := consulapi.DefaultConfig()
	config.Address = registry
	config.Scheme = "http"
	config.HttpAuth = &consulapi.HttpBasicAuth{Username: "admin", Password: "admin"}
	consul, err = consulapi.NewClient(config)
	if err != nil {
		return err
	}

	gen = pagegen.Must(pagegen.ParseGlob("assets/*.html"))
	return nil
}

// get coockie from a request
func getCookies(r *http.Request) map[string]string {
	cookies := r.Cookies()
	if len(cookies) == 0 {
		return nil
	}
	var cookieMap map[string]string = make(map[string]string)
	for _, cookie := range cookies {
		cookieMap[cookie.Name] = cookie.Value
	}
	return cookieMap
}

// get header value from a request
func getHeader(r *http.Request, header string) string {
	data := r.Header.Get(header)
	return data
}

// handle request
func requestHandler(w http.ResponseWriter, r *http.Request) {

	accept := r.Header.Get("accept")

	// Check if file request
	files, ok := r.URL.Query()["file"]
	if ok && len(files[0]) > 0 {
		sendFile(w, r, files[0])
		return
	}

	// Check if UI request
	if strings.Contains(accept, "html") {

		loginRequest := true

		cookies := getCookies(r)

		// if cookie exist check value
		if cookies != nil {
			provided_token, exists := cookies["diottoken"]
			if exists && provided_token == token {
				loginRequest = false
				log.Printf("loading profile page")
			} else {
				log.Printf("loading login page")
			}
		}

		// Check if a valid login request
		if loginRequest {
			loginPageHandle(w)
			return
		}

		profilePageHandle(w)
		return
	}

	// If API request
	if strings.Contains(accept, "json") {

		if r.Body == nil {
			http.Error(w, "", 500)
			return
		}

		var msg Message
		err := json.NewDecoder(r.Body).Decode(&msg)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		method := msg.Method

		log.Printf("requsted method: " + method)

		// LOGIN Request
		if msg.Method == "login" {
			loginRequestHandle(w, username, password)
			return
		}

		ptoken := getHeader(r, "token")

		if ptoken == "" || ptoken != token {
			log.Printf("invalid API token provided, " + ptoken)
			http.Error(w, "invalid API token provided", 500)
			return
		}

		// ENABLE/DISABLE
		if method == "enable" || method == "disable" {
			value := msg.Value
			device := msg.Device
			skillRequestHandle(w, device, method, value)
			return
		}
		// STATE
		if method == "state" {
			device := msg.Device
			statusRequestHandle(w, device)
			return
		}

		// DEVICE Register
		if method == "register" {
			device := msg.Device
			registerRequestHandle(w, device, msg)
			return
		}
	}

}

// API Requests

// Register (device, address, skill)
func registerRequestHandle(w http.ResponseWriter, device string, msg Message) {

	skills := msg.Skills
	deviceaddr := msg.DeviceAddr

	devicepath := "diot/devices/" + device

	skillList, _ := json.Marshal(&skills)
	skill := &consulapi.KVPair{Key: devicepath + "/skills", Value: []byte(skillList)}
	address := &consulapi.KVPair{Key: devicepath + "/address", Value: []byte(deviceaddr)}

	kv := consul.KV()
	_, err := kv.Put(skill, nil)
	if err != nil {
		log.Printf("failed to register device skill, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to register device skill, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}

	_, err = kv.Put(address, nil)
	if err != nil {
		log.Printf("failed to register device address, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to register device skill, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", jsonType)

	log.Printf("successfully registered device %s", device)
}

// Login (username, pass)
func loginRequestHandle(w http.ResponseWriter, provided_user, provided_pass string) {

	// Check if right credential
	if username == provided_user && password == provided_pass {
		log.Printf("successfull login")
		w.Header().Set("Content-Type", jsonType)
		w.Header().Set("diotcookie", "diottoken="+token)
		return
	}
	w.Header().Set("Content-Type", jsonType)
	log.Printf("invalid User and Password provided, " + provided_user + ", " + provided_pass)
	http.Error(w, "{\"error\":\"Invalid username or password\"}", http.StatusInternalServerError)
	return
}

// Skill (device, method, value)
func skillRequestHandle(w http.ResponseWriter, device, method, value string) {

	kv := consul.KV()
	devicepath := "diot/devices/" + device
	kvPair, _, err := kv.Get(devicepath+"/address", nil)
	if err != nil {
		log.Printf("failed to get device address, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to get device address, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}
	address := string(kvPair.Value)

	if address == "" {
		log.Printf("error, invalid device address: rasp_ctl url: " + address)
		http.Error(w, "internal error: invalid deviceUrl", http.StatusInternalServerError)
		return
	}

	deviceUrl := address + "/skill/switch/" + method + "/" + value

	client := &http.Client{}
	req, _ := http.NewRequest("GET", deviceUrl, nil)
	req.Header.Add("Content-Type", "application/json")
	resp, reqerr := client.Do(req)
	if reqerr != nil {
		log.Printf("failed to request device, error: %v", reqerr)
		http.Error(w, fmt.Sprintf("failed to request device, error: %v", reqerr), http.StatusInternalServerError)
		return
	}
	body, readerr := ioutil.ReadAll(resp.Body)
	if readerr != nil {
		log.Printf("failed to request device %s, error: %v", device, readerr)
	}

	w.Header().Set("Content-Type", jsonType)
	w.Write(body)
	log.Printf("successfull skill request for device %s with method %s and value %s ", device, method, value)
}

// Device state (:device)
func statusRequestHandle(w http.ResponseWriter, device string) {

	kv := consul.KV()
	deviceAddress := make(map[string]string)

	if device != "" {
		// Get specified device address
		kvPair, _, err := kv.Get("diot/devices/"+device+"/address", nil)
		if err != nil {
			log.Printf("failed to get device address, error: " + err.Error())
			http.Error(w, "{\"error\":\"failed to get device address, "+err.Error()+"\"}", http.StatusInternalServerError)
			return
		}
		deviceAddress[device] = string(kvPair.Value)
	} else {
		keys, _, err := kv.Keys("diot/devices/", "/", nil)
		if err != nil {
			log.Printf("failed to get device address, error: " + err.Error())
			http.Error(w, "{\"error\":\"failed to get device address, "+err.Error()+"\"}", http.StatusInternalServerError)
			return
		}
		for _, key := range keys {
			device := filepath.Base(key)
			kvPair, _, err := kv.Get(key+"address", nil)
			if err != nil {
				log.Printf("failed to get device address, error: " + err.Error())
				continue
			}
			deviceAddress[device] = string(kvPair.Value)
		}
	}

	allState := make(map[string]interface{})

	for deviceName, address := range deviceAddress {

		log.Printf("device %s, device address: %s", deviceName, address)

		deviceUrl := address + "/skill/switch/state/all"
		client := &http.Client{}
		req, _ := http.NewRequest("GET", deviceUrl, nil)
		req.Header.Add("Content-Type", "application/json")
		resp, reqerr := client.Do(req)

		if reqerr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, reqerr)
			continue
		}

		body, readerr := ioutil.ReadAll(resp.Body)
		if readerr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, readerr)
			continue
		}

		var jsObj map[string]interface{}
		jserr := json.Unmarshal([]byte(body), &jsObj)
		if jserr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, jserr)
			continue
		}

		log.Printf("device %s status with properties: %v", deviceName, jsObj)

		allState[deviceName] = jsObj
	}

	reqBody, merr := json.Marshal(allState)
	if merr != nil {
		log.Printf("failed to perform device request, error: %v", merr)
		allState[device] = "false"
		http.Error(w, fmt.Sprintf("failed to perform device request, error: %v", merr), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", jsonType)
	w.Write(reqBody)
}

// HTML Requests

// Login Page Request
func loginPageHandle(w http.ResponseWriter) {

	htmlObj := HtmlObject{PublicURL: public_uri}

	err := gen.ExecuteTemplate(w, "login", htmlObj)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to generate requested page, error: %v", err), http.StatusInternalServerError)
	}
}

// Profile Page Request
func profilePageHandle(w http.ResponseWriter) {

	kv := consul.KV()
	deviceAddress := make(map[string]string)

	keys, _, err := kv.Keys("diot/devices/", "/", nil)
	if err != nil {
		log.Printf("failed to get device address, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to get device address, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}
	for _, key := range keys {
		device := filepath.Base(key)
		kvPair, _, err := kv.Get(key+"address", nil)
		if err != nil {
			log.Printf("failed to get device address, error: " + err.Error())
			continue
		}
		deviceAddress[device] = string(kvPair.Value)
	}

	allState := make(map[string]*Device)

	for deviceName, address := range deviceAddress {

		log.Printf("device %s, device address: %s", deviceName, address)

		device := &Device{}
		deviceUrl := address + "/skill/switch/state/all"
		client := &http.Client{}
		req, _ := http.NewRequest("GET", deviceUrl, nil)
		req.Header.Add("Content-Type", "application/json")
		resp, reqerr := client.Do(req)

		device.State = true

		if reqerr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, reqerr)
			device.State = false
			continue
		}

		body, readerr := ioutil.ReadAll(resp.Body)
		if readerr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, readerr)
			device.State = false
			continue
		}

		var jsObj map[string]interface{}
		jserr := json.Unmarshal([]byte(body), &jsObj)
		if jserr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, jserr)
			device.State = false
			continue
		}

		device.Values = jsObj

		log.Printf("device %s loaded with properties: %v", deviceName, device)

		allState[deviceName] = device
	}

	htmlObj := HtmlObject{PublicURL: public_uri, Token: token, Devices: allState}

	err = gen.ExecuteTemplate(w, "profile", htmlObj)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to generate requested page, error: %v", err), http.StatusInternalServerError)
	}
}

// Static file request handler
func sendFile(w http.ResponseWriter, r *http.Request, file string) {
	filepath, valid := static_files[file]
	if !valid {
		http.Error(w, fmt.Sprintf("requested file %s is Invalid", file), http.StatusInternalServerError)
		return
	}
	http.ServeFile(w, r, filepath)
}

func main() {

	err := initialize()
	if err != nil {
		log.Fatal("failed to initialize the gateway, error: ", err.Error())
	}
	log.Printf("successfully initialized gateway")

	http.HandleFunc("/", requestHandler)

	log.Fatal(http.ListenAndServe(":8080", nil))
}
