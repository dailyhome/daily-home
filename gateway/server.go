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

	D_TOKEN    = "just-because-something-doesnt-do-what-you-planned-it-to-do-doesnt-mean-its-useless"
	D_USER     = "admin"
	D_PASS     = "admin"
	D_REGISTRY = "registry_consul:8500"
)

var (
	token      = ""
	username   = ""
	password   = ""
	registry   = ""
	public_uri = ""

	consul *consulapi.Client = nil
	gen    *pagegen.Template = nil
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
	Values map[string]string
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
		token = D_TOKEN
	}
	username = os.Getenv("username")
	if username == "" {
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

	config := consulapi.DefaultConfig()
	config.Address = registry
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
		switch files[0] {
		case "login.js":
			sendLoginJs(w, r)
			return
		case "profile.js":
			sendProfileJs(w, r)
			return

		case "login_style.css":
			sendLoginCss(w, r)
			return

		case "style.css":
			sendProfileCss(w, r)
			return
		}
	}

	// Check if UI request
	if strings.Contains(accept, "html") {

		loginRequest := true

		cookies := getCookies(r)

		// if cookie exist check value
		if cookies != nil {
			provided_token, exists := cookies["diottoken"]
			if exists && provided_token == token {
				log.Printf("loading profile page")
				loginRequest = false
			} else {
				log.Printf("invalid token provided, directing to login page")
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

		log.Printf("requsted method, " + method)

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
	_, _, err := kv.Acquire(skill, nil)
	if err != nil {
		log.Printf("failed to register device skill, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to register device skill, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}

	_, _, err = kv.Acquire(address, nil)
	if err != nil {
		log.Printf("failed to register device address, error: " + err.Error())
		http.Error(w, "{\"error\":\"failed to register device skill, "+err.Error()+"\"}", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", jsonType)
}

// Login (username, pass)
func loginRequestHandle(w http.ResponseWriter, provided_user, provided_pass string) {

	// Check if right credential
	if username == provided_user && password == provided_pass {
		log.Printf("Login Successfull")
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
	_, reqerr := client.Do(req)
	if reqerr != nil {
		log.Printf("failed to request device, error: %v", reqerr)
		http.Error(w, fmt.Sprintf("failed to request device, error: %v", reqerr), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", jsonType)
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
		// Found devices and their address
		keys, _, err := kv.Keys("diot/devices/", "/", nil)
		if err != nil {
			log.Printf("failed to get device address, error: " + err.Error())
			http.Error(w, "{\"error\":\"failed to get device address, "+err.Error()+"\"}", http.StatusInternalServerError)
			return
		}
		for _, key := range keys {
			fmt.Println(key)
			if filepath.Base(key) != "address" {
				continue
			}
			devicePath := filepath.Dir(key)
			device := filepath.Base(devicePath)

			kvPair, _, err := kv.Get(devicePath+"/address", nil)
			if err != nil {
				log.Printf("failed to get device address, error: " + err.Error())
				continue
			}
			deviceAddress[device] = string(kvPair.Value)
		}
	}

	var allState map[string]interface{}

	for device, address := range deviceAddress {
		deviceUrl := address + "/skill/switch/state/all"
		client := &http.Client{}
		req, _ := http.NewRequest("GET", deviceUrl, nil)
		req.Header.Add("Content-Type", "application/json")
		resp, reqerr := client.Do(req)
		if reqerr != nil {
			log.Printf("failed to request device, error: %v", reqerr)
			allState[device] = "false"
			continue
		}
		body, readerr := ioutil.ReadAll(resp.Body)
		if readerr != nil {
			log.Printf("failed to perform device request, error: %v", readerr)
			allState[device] = "false"
			continue
		}
		var jsObj map[string]interface{}
		jserr := json.Unmarshal([]byte(body), &jsObj)
		if jserr != nil {
			log.Printf("failed to perform device request, error: %v", jserr)
			allState[device] = "false"
			continue
		}

		allState[device] = jsObj
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
		fmt.Println(key)
		if filepath.Base(key) != "address" {
			continue
		}
		devicePath := filepath.Dir(key)
		device := filepath.Base(devicePath)

		kvPair, _, err := kv.Get(devicePath+"/address", nil)
		if err != nil {
			log.Printf("failed to get device address, error: " + err.Error())
			continue
		}
		deviceAddress[device] = string(kvPair.Value)
	}

	allState := make(map[string]*Device)

	for deviceName, address := range deviceAddress {
		device := &Device{}

		deviceUrl := address + "/skill/switch/state/all"
		client := &http.Client{}
		req, _ := http.NewRequest("GET", deviceUrl, nil)
		req.Header.Add("Content-Type", "application/json")
		resp, reqerr := client.Do(req)
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

		var jsObj map[string]bool
		jserr := json.Unmarshal([]byte(body), &jsObj)
		if jserr != nil {
			log.Printf("failed to request device %s, error: %v", deviceName, jserr)
			device.State = false
			continue
		}

		allState[deviceName] = device
	}

	htmlObj := HtmlObject{PublicURL: public_uri, Token: token, Devices: allState}

	err = gen.ExecuteTemplate(w, "profile", htmlObj)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to generate requested page, error: %v", err), http.StatusInternalServerError)
	}
}

// Static file
func sendLoginJs(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./assets/static/javascript/login.js")
}

func sendProfileJs(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./assets/static/javascript/profile.js")
}

func sendLoginCss(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./assets/static/css/login_style.css")
}

func sendProfileCss(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./assets/static/css/style.css")
}

func main() {

	err := initialize()
	if err != nil {
		log.Fatal("failed to initialize the gateway, error: ", err.Error())
	}

	http.HandleFunc("/", requestHandler)

	log.Fatal(http.ListenAndServe(":8080", nil))
}
