const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createFileStateStore } = require('../src/storage/file-state-store');
const { createTracker } = require('../src/tracker');

async function createTempFilePath() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'time-tracker-tracker-'));
  return path.join(tempDirectory, 'state.json');
}

test('tracker persists sessions after commands', async () => {
  const filePath = await createTempFilePath();
  const times = [
    '2026-05-04T09:00:00.000Z',
    '2026-05-04T09:45:00.000Z'
  ];
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => times.shift()
  });

  await tracker.start('PROJ-1');
  await tracker.pause();

  const persistedState = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.deepEqual(persistedState.sessions, [
    {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z',
      endAt: '2026-05-04T09:45:00.000Z',
      durationMs: 2700000
    }
  ]);
  assert.equal(persistedState.status, 'idle');
  assert.equal(persistedState.activeEntry, null);
});

test('tracker restores an active session after reload', async () => {
  const filePath = await createTempFilePath();
  const store = createFileStateStore({ filePath });
  const firstTracker = createTracker({
    store,
    now: () => '2026-05-04T11:00:00.000Z'
  });

  await firstTracker.start('PROJ-7');

  const secondTracker = createTracker({
    store,
    now: () => '2026-05-04T11:30:00.000Z'
  });

  const state = await secondTracker.getState();

  assert.deepEqual(state, {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-7',
      startAt: '2026-05-04T11:00:00.000Z'
    },
    sessions: []
  });
});