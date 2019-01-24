#!/bin/bash

# Check if docker is installed 
if ! [ -x "$(command -v docker)" ]; then
  echo 'Unable to find docker command, please install Docker (https://www.docker.com/) and retry' >&2
  exit 1
fi

# Get the additional openfaas template
echo "Getting Required Template"
faas-cli template pull https://github.com/alexellis/node8-express-template

# Build and deploy 
echo "Building the DailyIOT platform"
docker build -t s8sg/dhome-gateway:1.0.0 gateway/
faas-cli build -f stack.yml


echo "deploying functions"
faas-cli deploy -f stack.yml
