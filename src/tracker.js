const { applyCommand } = require('./domain/state-machine');

function createTracker({
  store,
  now = () => new Date().toISOString()
}) {
  async function runCommand(command) {
    const currentState = await store.load();
    const nextState = applyCommand(currentState, {
      ...command,
      at: now()
    });

    await store.save(nextState);

    return nextState;
  }

  return {
    async getState() {
      return store.load();
    },

    async start(ticketId) {
      return runCommand({ type: 'start', ticketId });
    },

    async switch(ticketId) {
      return runCommand({ type: 'switch', ticketId });
    },

    async pause() {
      return runCommand({ type: 'pause' });
    },

    async punchOut() {
      return runCommand({ type: 'punchOut' });
    }
  };
}

module.exports = {
  createTracker
};