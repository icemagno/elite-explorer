FROM openjdk:22-jdk
LABEL maintainer="Carlos M. Abreu <magno.mabreu@gmail.com>"

COPY ./target/cmdrscan-server-1.0.0.jar /opt/lib/
ENTRYPOINT ["java"]
ENV LANG=pt_BR.utf8 
CMD ["-jar", "/opt/lib/cmdrscan-server-1.0.0.jar"]