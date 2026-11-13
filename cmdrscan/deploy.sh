#! /bin/sh

docker run --rm -it --security-opt seccomp=unconfined \
-v ~/.m2:/root/.m2 \
-v ${PWD}:/home/builder \
magnoabreu/java-builder:java24 mvn clean package

docker rmi magnoabreu/cmdrscan:1.0
docker build --tag=magnoabreu/cmdrscan:1.0 --rm=true .

docker stop cmdrscan && docker rm cmdrscan

docker run --name cmdrscan --network=interna --hostname=cmdrscan \
--restart=always \
-d -p 36058:8081 \
-v /srv/cmdrscan:/cmdrscan \
magnoabreu/cmdrscan:1.0

