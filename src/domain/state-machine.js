const { createSession } = require('./session');

function createInitialState() {
  return {
    status: 'idle',
    activeEntry: null,
    sessions: []
  };
}

function beginWork(state, ticketId, at) {
  return {
    ...state,
    status: 'working',
    activeEntry: {
      ticketId,
      startAt: at
    }
  };
}

function endActiveWork(state, at) {
  if (!state.activeEntry) {
    return state;
  }

  const completedSession = createSession({
    ticketId: state.activeEntry.ticketId,
    startAt: state.activeEntry.startAt,
    endAt: at
  });

  return {
    status: 'idle',
    activeEntry: null,
    sessions: [...state.sessions, completedSession]
  };
}

function applyCommand(state, command) {
  switch (command.type) {
    case 'start':
    case 'switch': {
      const stoppedState = endActiveWork(state, command.at);
      return beginWork(stoppedState, command.ticketId, command.at);
    }
    case 'pause':
    case 'punchOut':
      return endActiveWork(state, command.at);
    default:
      throw new Error(`Unsupported command type: ${command.type}`);
  }
}

module.exports = {
  createInitialState,
  applyCommand
};