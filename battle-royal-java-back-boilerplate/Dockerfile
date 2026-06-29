FROM docker.io/library/maven:3.9.11-eclipse-temurin-25-noble AS maven
FROM docker.io/library/eclipse-temurin:26-jdk-noble AS build

COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH="/usr/share/maven/bin:${PATH}"

WORKDIR /workspace

COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp clean package assembly:single

RUN "$JAVA_HOME/bin/jlink" \
    --add-modules java.se,jdk.unsupported \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress=2 \
    --output /opt/java-minimal

FROM gcr.io/distroless/base-debian13:nonroot

ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=dev

LABEL org.opencontainers.image.title="DO Royal Backend" \
      org.opencontainers.image.description="Javalin WebSocket backend for DO Royal" \
      org.opencontainers.image.source="https://github.com/laflut3/DO_royal" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="MIT"

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV SERVER_PORT=8080

WORKDIR /app

COPY --from=build /opt/java-minimal "${JAVA_HOME}"
COPY --from=build --chown=nonroot:nonroot /workspace/target/battle-royal-back-1.0-SNAPSHOT-jar-with-dependencies.jar ./app.jar

USER nonroot:nonroot
EXPOSE 8080

ENTRYPOINT ["/opt/java/openjdk/bin/java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
