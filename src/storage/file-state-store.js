const fs = require('node:fs/promises');
const path = require('node:path');

const { createInitialState } = require('../domain/state-machine');

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
    sessions: Array.isArray(value?.sessions) ? value.sessions : []
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