# Image Game Server operations

This guide covers the observability available before the later production-hardening/persistence phase.

## Health

`GET /health` returns non-secret service metadata:

```json
{
  "name": "image-game-server",
  "status": "ok",
  "version": "0.0.0",
  "uptimeSeconds": 42,
  "timestamp": "2026-08-14T13:30:00.000Z"
}
```

A successful HTTP health response proves the Express function is running. The client Playwright suite separately proves the real Socket.IO/WebSocket game flow.

## Structured log format

Application events are emitted as single-line JSON, for example:

```json
{"timestamp":"2026-08-14T13:30:00.000Z","level":"info","scope":"socket","event":"game_state_changed","roomID":"ABC123","previousState":"lobby","state":"ideation"}
```

Common events:

| Event | Meaning |
| --- | --- |
| `socket_connected` | A realtime connection was accepted. |
| `socket_disconnected` | A realtime connection closed. |
| `room_joined` | A socket switched into a game room. |
| `player_joined` | A logical player joined/rejoined a room. |
| `game_state_changed` | Host UI moved the game to another phase. |
| `generator_changed` | Image provider selection changed. |
| `prompt_submitted` | A prompt was accepted for generation; prompt text is not logged. |
| `image_generation_completed` | Provider generation completed or returned a pending ID. |
| `image_generation_failed` | Provider generation threw an error. |
| `image_refresh_completed` | Provider refresh/poll completed. |
| `image_refresh_failed` | Provider refresh/poll threw an error. |
| `vote_recorded` / `vote_removed` | Vote state changed. |
| `protocol_rejected` | A client action failed validation or orchestration. |
| `game_reset` | A room was reset. |

## Useful troubleshooting sequences

### Client cannot connect

1. Confirm `/health` returns `status: ok`.
2. Search logs for `socket_connected`.
3. If there is no socket event, check the client Socket.IO hostname/path and Vercel deployment routing.
4. If sockets connect but the room never appears, search for `room_joined` and `protocol_rejected`.

### Prompt never produces an image

1. Find `prompt_submitted` for the room/player.
2. Look for a matching `image_generation_completed` or `image_generation_failed`.
3. Check the `generator` and `durationMs` fields.
4. For Stable Horde pending generations, check subsequent `image_refresh_completed` events.

### Players see different game state

The current room registry is process-local. Before shared persistence is introduced, different server instances can hold different copies of a room. Confirm the symptom is not caused by a deployment/restart before debugging client state.

## Privacy boundary

Operational logs intentionally omit prompt text and provider credentials. Do not add secrets, API tokens or generated-image payloads to structured log details.

## Deferred production work

Host authority, shared persistence/pub-sub, restrictive CORS/rate limiting and alerting/error aggregation remain a separate productionisation phase.
