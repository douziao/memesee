ARG SERVICE
ARG BACKEND_BUILD_IMAGE=maven:3.9.9-eclipse-temurin-21
ARG BACKEND_RUNTIME_IMAGE=eclipse-temurin:21-jre

FROM ${BACKEND_BUILD_IMAGE} AS build
ARG SERVICE
WORKDIR /workspace

COPY pom.xml pom.xml
COPY platform-common/pom.xml platform-common/pom.xml
COPY user-service/pom.xml user-service/pom.xml
COPY content-service/pom.xml content-service/pom.xml
COPY gateway-service/pom.xml gateway-service/pom.xml

RUN mvn -pl "${SERVICE}" -am dependency:go-offline -DskipTests

COPY . .
RUN mvn -pl "${SERVICE}" -am package -DskipTests

FROM ${BACKEND_RUNTIME_IMAGE}
ARG SERVICE
WORKDIR /app

ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS=""

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && groupadd --system memesee \
    && useradd --system --gid memesee --home-dir /app --shell /usr/sbin/nologin memesee \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=memesee:memesee /workspace/${SERVICE}/target/${SERVICE}-*.jar /app/app.jar

USER memesee
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
