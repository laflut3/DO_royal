# Battle Royal Java Back Boilerplate

A minimal Java/Maven boilerplate for a Battle Royale game backend. It exposes a
WebSocket endpoint (`/game`) built on [Javalin](https://javalin.io/) and uses
Log4j2 for logging.

## Requirements

- **JDK 26** — the project compiles against `maven.compiler.release = 26`
  (see [pom.xml](pom.xml)). Make sure `java -version` reports 26 or newer.
- **Maven 3.x** — used to build, test, and package the application.

## Setup

Clone the repository and fetch dependencies:

```sh
git clone <repository-url>
cd battle-royal-java-back-boilerplate
mvn dependency:resolve
```

## Build

Compile the sources and run the tests:

```sh
mvn clean package
```

To produce a self-contained "fat" JAR that bundles all dependencies (main class
`com.nmeo.App`):

```sh
mvn clean compile assembly:single
```

The runnable artifact is written to
`target/battle-royal-back-1.0-SNAPSHOT-jar-with-dependencies.jar`.

## Run

```sh
java -jar target/battle-royal-back-1.0-SNAPSHOT-jar-with-dependencies.jar
```

Or use the convenience script, which performs the build and run steps in one
go (see [compile_and_run.sh](compile_and_run.sh)):

```sh
./compile_and_run.sh
```

### Configuration

| Environment variable | Default | Description                    |
| -------------------- | ------- | ------------------------------ |
| `SERVER_PORT`        | `8080`  | Port the WebSocket server binds to. |

## Usage

Once running, the server listens for WebSocket connections at:

```
ws://localhost:8080/game
```
