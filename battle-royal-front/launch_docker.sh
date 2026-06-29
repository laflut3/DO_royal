#!/bin/sh
set -e

docker build -t battle-royale-front .
docker run -p 127.0.0.1:5000:5000 battle-royale-front
