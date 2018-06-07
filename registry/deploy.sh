#!/bin/bash
[ ! "$(docker network ls | grep consul)" ] && docker network create consul -d overlay --subnet=172.20.0.0/24
docker deploy --compose-file=diot-registry-swarm.yml registry
