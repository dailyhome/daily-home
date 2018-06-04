## DailyIOT
#### open IoT platform powered by openfaas targeted easy adaptation

## Overview of DailyIOT
> IOT Made Simple

    DailyIOT platform make use of OpenFaaS for its core
    Gateway : Handle UI and API call
    ALEXA : Handle Alexa Request
    Metric : Compute Mrtrics and Handle Metrics Request
    APPS : User Defined Apps as Function 
    
    MINIO: Store Device Info, Skill Definiton 
    PROMETHEUS: Store Metrics
    
    
> DailyIOT platform Stack 

<p align="center">
 <img src="https://farm2.staticflickr.com/1735/42496772422_bd9381a9d7_o.jpg">
</p>




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

## Overview Of Current Work

> Login Page (admin)

![login](https://farm1.staticflickr.com/897/41565051815_a44470fb4e_h.jpg)

> Switching Device

![Switching Device](https://farm2.staticflickr.com/1760/42467480791_c831254071_b.jpg)
