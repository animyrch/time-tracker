const fs = require('node:fs/promises');
const path = require('node:path');

const { createInitialState } = require('../domain/state-machine');
const {
  buildSessionId,
  getDurationInMilliseconds,
  getDurationInSeconds
} = require('../domain/session');

function normalizeSession(session) {
  const durationMs = Number.isFinite(session?.durationMs)
    ? session.durationMs
    : getDurationInMilliseconds(session.startAt, session.endAt);

  return {
    id: typeof session?.id === 'string' ? session.id : buildSessionId(session),
    ticketId: session.ticketId,
    startAt: session.startAt,
    endAt: session.endAt,
    durationMs,
    durationSeconds: Number.isFinite(session?.durationSeconds)
      ? session.durationSeconds
      : getDurationInSeconds(session.startAt, session.endAt),
    synced: session?.synced === true,
    syncError: typeof session?.syncError === 'string' ? session.syncError : null
  };
}

async function ensureStateFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    await fs.writeFile(filePath, `${JSON.stringify(createInitialState(), null, 2)}\n`);
  }
}

function normalizeState(value) {
  return {
    status: value?.status === 'working' ? 'working' : 'idle',
    activeEntry: value?.activeEntry ?? null,
    sessions: Array.isArray(value?.sessions) ? value.sessions.map(normalizeSession) : []
  };
}

function createFileStateStore({ filePath }) {
  return {
    async load() {
      await ensureStateFile(filePath);
      const contents = await fs.readFile(filePath, 'utf8');
      return normalizeState(JSON.parse(contents));
    },

    async save(state) {
      await ensureStateFile(filePath);
      await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`);
    }
  };
}

module.exports = {
  createFileStateStore
};