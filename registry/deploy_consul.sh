#!/bin/bash
docker pull s8sg/consul
[ ! "$(docker network ls | grep consul)" ] && docker network create consul -d overlay --subnet=172.20.0.0/24
docker deploy --compose-file=consul-swarm.yml statestore
