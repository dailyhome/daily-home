#!/bin/bash
. secrets
echo "$REGISTRY_ACCESS_KEY" | docker secret create diot_registry_access_key -
echo "$REGISTRY_SECRET_KEY" | docker secret create diot_registry_secret_key -
docker stack deploy --compose-file=diot-registry-swarm.yaml diot-registry
