# Image Game Server

Node.js/Express + Socket.IO backend for the multiplayer Image Game. Players join isolated rooms, submit prompts, generate images through a configured provider and vote on each other's results in real time.

## Current architecture

The server is intentionally split into explicit layers:

- `game-session.js` — game domain/state model plus the in-memory room registry.
- `game-service.js` — prompt/image orchestration against the selected provider.
- `image-providers.js` — normalized Mock, Stable Horde and DALL-E provider adapters.
- `chat.js` — Socket.IO transport, room membership, event mapping and broadcasts.
- `socket-server.js` — reusable HTTP/Socket.IO server factory shared by local and Vercel entry points.
- `api/socket-io.js` — Vercel realtime function entry point.
- `logger.js` — structured JSON operational logging.

Game/provider registries are injectable so domain and transport tests do not depend on process-global state.

> Game state is currently in memory only. Restarting or moving between independent server instances can lose or split rooms. Shared persistence remains intentionally deferred to the later production-hardening stage.

## Requirements and setup

- Node.js 24
- npm

```bash
npm ci
npm start
```

The local server listens on `PORT` when provided, otherwise `3000`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP/Socket.IO port; defaults to `3000`. |
| `HORDE_TOKEN` | Stable Horde only | Stable Horde API token. |
| `DALLE_TOKEN` | DALL-E only | OpenAI API token. |

The `Mock` generator requires no external credentials and is the default choice for automated/full-stack testing.

## HTTP endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Human-readable service landing page with game/health links. |
| `GET` | `/health` | Non-secret service metadata including status, version, uptime and timestamp. |
| `GET` | `/users` | Legacy placeholder route. |
| `GET` | `/room` | Legacy placeholder route. |

Most game behaviour is handled through Socket.IO.

## Socket.IO protocol

Client → server:

- `joinGame`
- `reset`
- `getGameState`
- `setGameState`
- `setGenerator`
- `getUsers`
- `addUser`
- `addPrompt`
- `updateImages`
- `vote`
- `unvote`

Server → client:

- `joinedGame`
- `gameState`
- `users`
- `protocolError`
- `reset-clients`

Room IDs, game states, generators, player identities/names and prompts are validated before mutation.

## Image providers

- `Stable Horde` — submits generation then refreshes until an image is ready.
- `Dall-e` — uses the OpenAI image client and normalizes its response to the game contract.
- `Mock` — returns a deterministic placeholder after a short artificial delay.

Provider-specific response shapes stay inside the adapters instead of leaking into Socket.IO handlers.

## Observability

Application lifecycle events are written as one-line JSON records suitable for Vercel log search. Events include socket connection/disconnection, room joins, game state/generator transitions, player joins, votes, protocol rejections and image-provider duration/failures.

Prompt text and provider credentials are **not** logged. Provider telemetry records room/player IDs, provider name, duration and result/failure metadata only.

See [`OPERATIONS.md`](./OPERATIONS.md) for event names and troubleshooting guidance.

## Development and quality gates

```bash
npm run lint
npm test
npm run test:coverage
npm run build
npm run check
```

`npm run test:coverage` uses Node 24's built-in coverage collector and enforces minimum line/function/branch coverage. `npm run build` is a syntax-validation gate rather than a bundling step.

Automated coverage includes HTTP/static routes, health metadata, `GameSession`, `GameService`, provider contracts, structured logging, Socket.IO room/protocol behaviour and a real Engine.IO/Socket.IO WebSocket handshake.

GitHub Actions runs deterministic install, production dependency audit, lint, coverage-enforced tests, syntax/build validation and a startup `/health` smoke test. CodeQL runs separately.

## Project structure

```text
app.js                    Express application setup
api/socket-io.js           Vercel Socket.IO entry point
bin/www                    Local server entry point
socket-server.js           Shared HTTP + Socket.IO server factory
chat.js                    Socket.IO transport/protocol mapping
game-session.js            Game domain state + room registry
game-service.js            Game/image orchestration
image-providers.js         Provider adapters
logger.js                  Structured operational logger
dalle.js                   Low-level OpenAI image wrapper
horde.js                   Low-level Stable Horde wrapper
routes/                     Express routes
public/                     Service landing page
test/                       Node.js tests
.github/workflows/ci.yml    CI validation
```

## Deferred production hardening

These are deliberately **not** part of this modernization pass:

- host authentication/authority
- shared persistent room state/pub-sub
- restrictive production CORS and rate limiting
- alerting/error aggregation beyond searchable structured logs

Those should be addressed together when the application is intentionally locked down for production.

## Licence

See [`LICENSE`](./LICENSE).
