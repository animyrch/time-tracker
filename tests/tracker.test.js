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
      id: 'PROJ-1:2026-05-04T09:00:00.000Z:2026-05-04T09:45:00.000Z',
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z',
      endAt: '2026-05-04T09:45:00.000Z',
      durationMs: 2700000,
      durationSeconds: 2700,
      synced: false,
      syncError: null
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

test('tracker normalizes Jira browse URLs into ticket IDs', async () => {
  const filePath = await createTempFilePath();
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => '2026-05-04T11:00:00.000Z'
  });

  const state = await tracker.start('https://expondo.atlassian.net/browse/COM-608');

  assert.deepEqual(state, {
    status: 'working',
    activeEntry: {
      ticketId: 'COM-608',
      startAt: '2026-05-04T11:00:00.000Z'
    },
    sessions: []
  });
});

test('tracker does not close and reopen the same normalized active ticket', async () => {
  const filePath = await createTempFilePath();
  const times = [
    '2026-05-04T11:00:00.000Z',
    '2026-05-04T11:05:00.000Z'
  ];
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => times.shift()
  });

  await tracker.start('COM-608');
  const state = await tracker.switch('https://expondo.atlassian.net/browse/COM-608');

  assert.deepEqual(state, {
    status: 'working',
    activeEntry: {
      ticketId: 'COM-608',
      startAt: '2026-05-04T11:00:00.000Z'
    },
    sessions: []
  });
});

test('tracker marks a completed session as synced when Jira worklog delivery succeeds', async () => {
  const filePath = await createTempFilePath();
  const sentSessions = [];
  const times = [
    '2026-05-04T09:00:00.000Z',
    '2026-05-04T09:30:00.000Z'
  ];
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => times.shift(),
    worklogSync: {
      isConfigured: true,
      async sendSession(session) {
        sentSessions.push(session);
      }
    }
  });

  await tracker.start('PROJ-5');
  const state = await tracker.pause();

  assert.equal(sentSessions.length, 1);
  assert.equal(sentSessions[0].ticketId, 'PROJ-5');
  assert.deepEqual(state.sessions, [
    {
      id: 'PROJ-5:2026-05-04T09:00:00.000Z:2026-05-04T09:30:00.000Z',
      ticketId: 'PROJ-5',
      startAt: '2026-05-04T09:00:00.000Z',
      endAt: '2026-05-04T09:30:00.000Z',
      durationMs: 1800000,
      durationSeconds: 1800,
      synced: true,
      syncError: null
    }
  ]);
});

test('tracker preserves completed sessions when Jira worklog delivery fails', async () => {
  const filePath = await createTempFilePath();
  const times = [
    '2026-05-04T12:00:00.000Z',
    '2026-05-04T12:15:00.000Z'
  ];
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => times.shift(),
    worklogSync: {
      isConfigured: true,
      async sendSession() {
        throw new Error('Issue does not exist');
      }
    }
  });

  await tracker.start('PROJ-404');
  const state = await tracker.pause();

  assert.deepEqual(state.sessions, [
    {
      id: 'PROJ-404:2026-05-04T12:00:00.000Z:2026-05-04T12:15:00.000Z',
      ticketId: 'PROJ-404',
      startAt: '2026-05-04T12:00:00.000Z',
      endAt: '2026-05-04T12:15:00.000Z',
      durationMs: 900000,
      durationSeconds: 900,
      synced: false,
      syncError: 'Issue does not exist'
    }
  ]);
});

test('tracker can retry unsynced sessions later', async () => {
  const filePath = await createTempFilePath();
  const times = [
    '2026-05-04T14:00:00.000Z',
    '2026-05-04T14:20:00.000Z'
  ];
  let shouldFail = true;
  const store = createFileStateStore({ filePath });
  const tracker = createTracker({
    store,
    now: () => times.shift(),
    worklogSync: {
      isConfigured: true,
      async sendSession() {
        if (shouldFail) {
          throw new Error('Temporary Jira outage');
        }
      }
    }
  });

  await tracker.start('PROJ-8');
  await tracker.pause();
  shouldFail = false;

  const state = await tracker.syncUnsyncedSessions();

  assert.deepEqual(state.sessions, [
    {
      id: 'PROJ-8:2026-05-04T14:00:00.000Z:2026-05-04T14:20:00.000Z',
      ticketId: 'PROJ-8',
      startAt: '2026-05-04T14:00:00.000Z',
      endAt: '2026-05-04T14:20:00.000Z',
      durationMs: 1200000,
      durationSeconds: 1200,
      synced: true,
      syncError: null
    }
  ]);
});