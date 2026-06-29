#!/bin/sh
set -eu
mvn clean package assembly:single
java -jar target/battle-royal-back-1.0-SNAPSHOT-jar-with-dependencies.jar
