const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialState, applyCommand } = require('../src/domain/state-machine');

test('switch closes the previous ticket session and starts the new ticket', () => {
  const state = {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z'
    },
    sessions: []
  };

  const nextState = applyCommand(state, {
    type: 'switch',
    ticketId: 'PROJ-2',
    at: '2026-05-04T09:30:00.000Z'
  });

  assert.deepEqual(nextState, {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-2',
      startAt: '2026-05-04T09:30:00.000Z'
    },
    sessions: [
      {
        ticketId: 'PROJ-1',
        startAt: '2026-05-04T09:00:00.000Z',
        endAt: '2026-05-04T09:30:00.000Z',
        durationMs: 1800000
      }
    ]
  });
});

test('pause ends the active session and moves the tracker to idle', () => {
  const state = {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z'
    },
    sessions: []
  };

  const nextState = applyCommand(state, {
    type: 'pause',
    at: '2026-05-04T09:10:00.000Z'
  });

  assert.deepEqual(nextState, {
    status: 'idle',
    activeEntry: null,
    sessions: [
      {
        ticketId: 'PROJ-1',
        startAt: '2026-05-04T09:00:00.000Z',
        endAt: '2026-05-04T09:10:00.000Z',
        durationMs: 600000
      }
    ]
  });
});

test('pause while idle leaves state unchanged', () => {
  const state = createInitialState();

  const nextState = applyCommand(state, {
    type: 'pause',
    at: '2026-05-04T09:10:00.000Z'
  });

  assert.deepEqual(nextState, state);
});

test('switch while idle starts a new active ticket', () => {
  const nextState = applyCommand(createInitialState(), {
    type: 'switch',
    ticketId: 'PROJ-2',
    at: '2026-05-04T09:30:00.000Z'
  });

  assert.deepEqual(nextState, {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-2',
      startAt: '2026-05-04T09:30:00.000Z'
    },
    sessions: []
  });
});

test('punchOut ends the active session and clears activity', () => {
  const state = {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z'
    },
    sessions: []
  };

  const nextState = applyCommand(state, {
    type: 'punchOut',
    at: '2026-05-04T09:45:00.000Z'
  });

  assert.equal(nextState.status, 'idle');
  assert.equal(nextState.activeEntry, null);
  assert.deepEqual(nextState.sessions, [
    {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z',
      endAt: '2026-05-04T09:45:00.000Z',
      durationMs: 2700000
    }
  ]);
});

test('punchOut while idle leaves state unchanged', () => {
  const state = createInitialState();

  const nextState = applyCommand(state, {
    type: 'punchOut',
    at: '2026-05-04T09:45:00.000Z'
  });

  assert.deepEqual(nextState, state);
});

test('start behaves like switch when a ticket is already active', () => {
  const state = {
    status: 'working',
    activeEntry: {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z'
    },
    sessions: []
  };

  const nextState = applyCommand(state, {
    type: 'start',
    ticketId: 'PROJ-2',
    at: '2026-05-04T09:20:00.000Z'
  });

  assert.equal(nextState.status, 'working');
  assert.deepEqual(nextState.activeEntry, {
    ticketId: 'PROJ-2',
    startAt: '2026-05-04T09:20:00.000Z'
  });
  assert.deepEqual(nextState.sessions, [
    {
      ticketId: 'PROJ-1',
      startAt: '2026-05-04T09:00:00.000Z',
      endAt: '2026-05-04T09:20:00.000Z',
      durationMs: 1200000
    }
  ]);
});