# Battle Royal Back

A Java/Maven for a Battle Royale game backend. It exposes a
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
cd battle-royal-back
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

## Runtime model

The backend is a WebSocket-first game server. The main runtime components are:

- `GameService`: owns game sessions and protected game-state transitions.
- `PlayerService`: owns player registration, updates, removals, and socket-to-player mapping.
- `BroadcastService`: owns the WebSocket registry and sends messages outside registry locks.
- `MovementBroadcastService`: batches high-frequency player movement updates.

### Thread safety

Each game has its own `GameSession` lock, so separate games can run in parallel while sensitive transitions inside one game stay ordered.

Mutable `Player` objects are copied before they leave protected state. Full `GAME_STATE` messages are built from a snapshot so the server does not serialize internal mutable objects while another thread is updating the same game.

The WebSocket registry also has its own lock. Broadcasts take a socket snapshot first, then send messages outside the registry lock.

### Movement performance

`PLAYER_MOVED` is the hottest message type. The server does not broadcast every movement immediately.

Instead, `MovementBroadcastService` stores the latest movement per player and per game, then flushes a batch every `50 ms`. This keeps the outgoing rate controlled for larger games while preserving recent movement state.

The frontend sends movement updates at up to `20 Hz` and accepts batched `PLAYER_MOVED` messages through the `players` field.

For the detailed concurrency model, see [`../doc/thread-safety.md`](../doc/thread-safety.md).
