#!/bin/sh
set -eu
mvn clean package assembly:single
JAVA_CMD="${JAVA_HOME:+$JAVA_HOME/bin/}java"
"$JAVA_CMD" -jar target/battle-royal-back-1.0-SNAPSHOT-jar-with-dependencies.jar
