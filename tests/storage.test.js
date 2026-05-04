const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createFileStateStore } = require('../src/storage/file-state-store');

async function createTempFilePath() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'time-tracker-storage-'));
  return path.join(tempDirectory, 'state.json');
}

test('load creates an empty state file when it does not exist', async () => {
  const filePath = await createTempFilePath();
  const store = createFileStateStore({ filePath });

  const state = await store.load();

  assert.deepEqual(state, {
    status: 'idle',
    activeEntry: null,
    sessions: []
  });

  const fileContents = await fs.readFile(filePath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), state);
});

test('save preserves state data on disk', async () => {
  const filePath = await createTempFilePath();
  const store = createFileStateStore({ filePath });
  const state = {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-9',
      startAt: '2026-05-04T13:00:00.000Z'
    },
    sessions: [
      {
        ticketId: 'PROJ-1',
        startAt: '2026-05-04T09:00:00.000Z',
        endAt: '2026-05-04T10:00:00.000Z',
        durationMs: 3600000
      }
    ]
  };

  await store.save(state);

  const reloadedState = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.deepEqual(reloadedState, state);
});