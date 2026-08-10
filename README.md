# Image Game Server

Node.js/Express + Socket.IO backend for a multiplayer image-generation game. Players join a shared room, submit prompts, generate images through a configured provider, and vote on each other's results in real time.

## What it does

- Serves a small Express HTTP API, landing page and health endpoint.
- Maintains the current game state and connected-player data in memory.
- Broadcasts state changes through Socket.IO.
- Supports image generation via Stable Horde, DALL-E, or a local mock generator.
- Supports voting and unvoting between players.

> Game state is currently in-memory only. Restarting the server resets the lobby, users, prompts, images and votes.

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
| `HORDE_API_URL` | No | Optional AI Horde API base URL. Defaults to `https://stablehorde.net/api/v2`. |
| `DALLE_TOKEN` | For DALL-E | OpenAI API token used by the DALL-E provider. |

The `Mock` generator does not require external credentials.

## HTTP endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Serves the existing static landing page. |
| `GET` | `/health` | JSON health response: `{ "name": "image-game-server", "status": "ok" }`. |
| `GET` | `/users` | Legacy placeholder users route. |
| `GET` | `/room` | Legacy placeholder room route. |

Most game behaviour is handled through Socket.IO rather than REST endpoints.

## Socket.IO events

### Client to server

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

- `gameState`
- `users`
- `debug`
- `reset-clients`

## Image providers

The game currently recognises these generator values:

- `Stable Horde` — submits a generation request and later polls for the generated image through the AI Horde REST API.
- `Dall-e` — generates an image through the OpenAI client.
- `Mock` — returns a placeholder image after a short artificial delay; useful for development without API credentials.

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

The test suite starts the Express application on an ephemeral local port and verifies the static landing page, health endpoint, users route and room route. It also verifies the Stable Horde and DALL-E adapters with mocked API clients, so no external image-generation APIs are called.

Future useful coverage would include Socket.IO game-state transitions, voting, reset behaviour, and provider adapters with mocked HTTP/API clients.

## CI

GitHub Actions runs on pull requests and pushes to `main` using Node.js 24. CI performs:

1. `npm ci --ignore-scripts`
2. production dependency audit
3. `npm run lint`
4. `npm test`
5. `npm run build`
6. startup smoke test against `/health`

## Project structure

```text
app.js                  Express application setup
bin/www                 HTTP + Socket.IO server entry point
chat.js                 Real-time game state and Socket.IO handlers
dalle.js                DALL-E adapter
horde.js                Stable Horde adapter
routes/                  Express routes
test/                    Node.js tests
.github/workflows/ci.yml CI validation
```

## Notes

- Socket.IO currently allows CORS from any origin. Restrict this before exposing the service beyond its intended frontend/deployment environment.
- Game state is process-local, so horizontal scaling would require shared persistence/pub-sub rather than multiple independent server instances.

## Licence

See [`LICENSE`](./LICENSE).
