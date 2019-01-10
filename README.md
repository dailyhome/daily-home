## DailyHOME
#### open home automation platform powered by openfaas targeted easy adaptation

## Overview of DailyHOME
> HOME automation Made Simple

    DailyHOME platform make use of OpenFaaS for its core
    Gateway : Handle UI and API call
    ALEXA : Handle Alexa Request
    Metric : Compute Mrtrics and Handle Metrics Request
    APPS : User Defined Apps as Function 
    
    MINIO: Store Device Info, Skill Definiton 
    PROMETHEUS: Store Metrics
    
    
> DailyIOT platform Stack 

<p align="center">
 <img src="https://farm1.staticflickr.com/895/27922686117_69fa6b0361_o.jpg">
</p>

### Getting Started

Daily-home platform runs completly on top of `openfaas`. To set up openfaas for the link: [Openfaas Getting Started](http://docs.openfaas.com/deployment/)
  
#### Clone the repo
```bash
git clone https://github.com/dailyhome/daily-home.git && cd daily-home
```
  
#### Start the Registry (Consul) 
Build locally  (optional)
```bash
cd registry && ./build.sh
```
Deploy
```bash
cd registry && ./deploy.sh
```

#### Deploy the DIot Platform
```bash
./deploy.sh
```

After deployment go to [http://127.0.0.1:8080/function/diot-gateway](http://127.0.0.1:8080/function/diot-gateway)

> Login Page (default: admin/admin)

![login](https://farm1.staticflickr.com/897/41565051815_a44470fb4e_h.jpg)

> Dummy Switching Device

![Switching Device](https://farm2.staticflickr.com/1760/42467480791_c831254071_b.jpg)


##### TODO
- [x] API - Implement HTTP API [dailyiot-gateway]
- [x] Implement Alexa skill [dailyiot-alexa]
- [x] API - Authtoken validation [dailyiot-gateway]
- [x] UI - Implement Glitchfree Switch Page [dailyiot-gateway]
- [x] UI - Implement Login Page with Cookie [dailyiot-gateway]
- [x] UI - Enable and Disable all switches [dailyiot-gateway]
- [x] UI - Ajax request to update/monitor state [dailyiot-gateway]
- [ ] Create METRIC Service and find a way to Generate useful metrics based on API Request, Like:  
      - daily/weekly total active period,  
      - daily/weekly average active period etc
- [ ] Template and SDK for Writing different IOT APP to run on the Platform (gateway, metric & alexa)
- [ ] Integrate with OpenFaaS-cloud
- [ ] Change password and token to secrets
- [ ] UI/API - provide UI and API support to get the metric [dailyiot-gateway]   
- [ ] Use minio as storage to keep device info [dailyiot-gateway]
- [ ] Custom switch name [dailyiot-gateway]
- [ ] UI - Multiple Device Layout [dailyiot-gateway]
- [ ] Write Documentation [dailyiot-gateway]
- [ ] Find a way to create Routine (without Alexa)


## Contribution guide
A Contribution can be in any form of a `Suggestion/Idea/PR (Implementation/Documentation)/Review`   
To open an suggestion, Idea or Issue please create an issue at:   
[https://github.com/dailyiot/dailyiot/issues](https://github.com/dailyiot/dailyiot/issues)   
For a PR please create an issue detailing the Idea/Suggestion/Issue  

