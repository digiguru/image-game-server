# Image Game Server

Node.js/Express + Socket.IO backend for the multiplayer Image Game. Players join isolated game rooms, submit prompts, generate images through a configured provider, and vote on each other's results in real time.

## What it does

- Serves a small Express HTTP API, landing page and health endpoint.
- Maintains independent in-memory `GameSession` state per room.
- Broadcasts room-scoped state changes through Socket.IO.
- Supports image generation via Stable Horde, DALL-E, or the local Mock provider.
- Supports prompt submission, voting/unvoting and game resets.
- Validates room IDs, game states, generators, player identities/names and prompts.

> Game state is currently in-memory only. Restarting or moving between independent server instances can lose or split rooms. Shared persistence is intentionally deferred to the later production-hardening stage.

## Requirements

- Node.js 24
- npm

## Setup

```bash
npm ci
npm start
```

The server listens on `PORT` when provided, otherwise it defaults to `3000`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP/Socket.IO port. Defaults to `3000`. |
| `HORDE_TOKEN` | For Stable Horde | API token used by the Stable Horde image provider. |
| `DALLE_TOKEN` | For DALL-E | OpenAI API token used by the DALL-E provider. |

The `Mock` generator does not require external credentials.

## HTTP endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Serves the small static landing page. |
| `GET` | `/health` | JSON health response: `{ "name": "image-game-server", "status": "ok" }`. |
| `GET` | `/users` | Legacy placeholder users route. |
| `GET` | `/room` | Legacy placeholder room route. |

Most game behaviour is handled through Socket.IO rather than REST endpoints.

## Socket.IO events

### Client to server

- `joinGame` — select/create a room; invalid room IDs fall back to `default`.
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

### Server to clients

- `joinedGame`
- `gameState`
- `users`
- `protocolError`
- `reset-clients`

## Architecture

The server is split into explicit layers so Socket.IO no longer owns the game rules or provider-specific behaviour:

- `game-session.js` — game domain/state model plus the in-memory room registry.
- `game-service.js` — prompt/image orchestration against the selected provider.
- `image-providers.js` — normalized Mock, Stable Horde and DALL-E provider adapters.
- `chat.js` — Socket.IO transport, room membership, event mapping and broadcasts.
- `socket-server.js` — reusable HTTP/Socket.IO server factory shared by local and Vercel entry points.
- `api/socket-io.js` — Vercel realtime function entry point.

The transport accepts injectable game/provider registries, which keeps domain/provider tests independent from process-global state.

## Image providers

The game recognises these generator values:

- `Stable Horde` — submits a generation request and later polls for the completed image.
- `Dall-e` — generates an image through the OpenAI client and normalizes the response into the game image contract.
- `Mock` — returns a placeholder image after a short artificial delay; used by development and full-stack tests without external credentials.

Provider-specific API response shapes and failures are contained inside the provider adapters rather than leaking into Socket.IO handlers.

## Development commands

```bash
npm run lint
npm test
npm run build
```

- `npm run lint` runs ESLint 10 with the repository flat config.
- `npm test` runs the Node.js built-in test runner.
- `npm run build` performs syntax validation across server and test entry points. This project does not have a compile/bundle step.

## Tests

Coverage includes:

- Express/static routes and `/health`.
- `GameSession` state isolation, validation, prompts, votes and player removal.
- `GameService` prompt-generation and provider-refresh orchestration.
- Mock, Stable Horde and DALL-E provider contracts with fake clients.
- Socket.IO transport behaviour including room isolation, state changes, reset, users, prompts, voting, disconnects and protocol errors.
- A real Engine.IO/Socket.IO WebSocket handshake smoke test against an ephemeral local server.

No external image-generation APIs are called by the automated suite.

## CI

GitHub Actions runs on pull requests and pushes to `main` using Node.js 24. CI performs deterministic dependency install, production dependency audit, lint, tests, syntax/build validation and a startup `/health` smoke test. CodeQL runs separately.

## Project structure

```text
app.js                    Express application setup
api/socket-io.js           Vercel Socket.IO entry point
bin/www                    Local server entry point
socket-server.js           Shared HTTP + Socket.IO server factory
chat.js                    Socket.IO transport/protocol mapping
game-session.js            Game domain state + room registry
game-service.js            Game/image orchestration
image-providers.js         Provider adapters and normalized image contract
dalle.js                   Low-level OpenAI image client wrapper
horde.js                   Low-level Stable Horde client wrapper
routes/                     Express routes
test/                       Node.js tests
.github/workflows/ci.yml    CI validation
```

## Deferred production hardening

The following are deliberately not part of the current modernization stage:

- host authentication/authority
- shared persistent room state/pub-sub
- restrictive production CORS and rate limiting
- production observability/alerting

Those should be addressed together when the application is intentionally locked down for production.

## Licence

See [`LICENSE`](./LICENSE).
