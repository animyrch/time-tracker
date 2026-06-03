# Time Tracker

Minimal local time tracking for ticket-based work. The project is built in Node.js, stores state in JSON on disk, exposes a CLI for fast workflows, and includes a small single-page web UI on top of the same tracker core.

## What It Does

- Tracks one active ticket at a time.
- Supports `start`, `switch`, and `pause` flows.
- Persists sessions locally in `data/tracker-state.json`.
- Shows human-readable status and reports in the terminal.
- Optionally syncs completed sessions to Jira worklogs.
- Exposes a lightweight web dashboard over the same backend logic.

## Requirements

- Node.js 22+ recommended.
- npm 10+ recommended.

## Install

```bash
npm install
npm test
```

## CLI Usage

Run commands through npm:

```bash
npm run cli -- status
```

Available commands:

- `npm run cli -- start <ticket>`
- `npm run cli -- switch <ticket>`
- `npm run cli -- pause`
- `npm run cli -- sync`
- `npm run cli -- status`
- `npm run cli -- report`
- `npm run cli -- sync`
- `npm run cli -- status`
- `npm run cli -- report`

Examples:

```bash
npm run cli -- start PROJ-123
npm run cli -- switch PROJ-456
npm run cli -- pause
npm run cli -- report
```

## Web UI

Start the local web server:

```bash
npm run web
```

Default URL:

```text
http://localhost:9999
```

Optional server environment variable:

- `PORT` overrides the default web port.

The web UI is a thin layer over the existing tracker and exposes these backend routes:

- `GET /state`
- `POST /start`
- `POST /switch`
- `POST /pause`


## Jira Sync

Jira sync is optional. The tracker always saves locally first, then attempts to sync completed sessions. It supports scoped OAuth tokens.

Environment variables used by the Jira integration:

- `JIRA_BASE_URL`
- `JIRA_API_TOKEN` (requires 'write:issue.time-tracking:jira' scope)

Example `.env` setup:

```text
JIRA_BASE_URL="https://your-domain.atlassian.net"
JIRA_API_TOKEN="your-scoped-token"
```

Notes:

- Jira sync only runs when those variables are present.
- Failed Jira sends do not lose local sessions.
- Unsynced sessions remain in local state and can be retried with `npm run cli -- sync`.
- The project includes `.env.example` as a reference, but the app does not load env files automatically.

## Storage

Local state is stored at:

```text
data/tracker-state.json
```

Each completed session stores:

- `ticketId`
- `startAt`
- `endAt`
- `durationMs`
- `durationSeconds`
- `synced`
- `syncError`

## Testing

The project uses Node's built-in test runner.

```bash
npm test
```

The test suite covers:

- Session creation and duration logic
- State transitions
- File persistence
- Tracker orchestration
- CLI behavior
- Jira adapter and client mapping

## Project Layout

```text
.
├── data/
├── src/
│   ├── cli/
│   ├── domain/
│   ├── integrations/
│   │   └── jira/
│   ├── storage/
│   ├── web/
│   │   └── public/
│   ├── index.js
│   └── tracker.js
├── tests/
├── .env.example
├── package.json
└── README.md
```

## Design Notes

- Core business logic stays in `src/domain`.
- Persistence stays in `src/storage`.
- CLI and web are thin interfaces over the same tracker.
- Jira integration is isolated in `src/integrations/jira` and is optional.
- Local persistence is the source of truth.