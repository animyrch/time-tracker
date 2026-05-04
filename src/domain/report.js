const { getDurationInMilliseconds } = require('./session');

function getSyncSummary(state) {
  return state.sessions.reduce((summary, session) => {
    if (session.synced) {
      summary.syncedDurationMs += session.durationMs;
      summary.syncedSessionCount += 1;
    } else {
      summary.unsyncedDurationMs += session.durationMs;
      summary.unsyncedSessionCount += 1;
    }

    return summary;
  }, {
    syncedDurationMs: 0,
    syncedSessionCount: 0,
    unsyncedDurationMs: 0,
    unsyncedSessionCount: 0
  });
}

function getActiveStatus(state, now) {
  if (!state.activeEntry) {
    return null;
  }

  return {
    ticketId: state.activeEntry.ticketId,
    startAt: state.activeEntry.startAt,
    elapsedMs: getDurationInMilliseconds(state.activeEntry.startAt, now)
  };
}

function buildReport(state, now) {
  const totalsByTicket = new Map();
  const syncSummary = getSyncSummary(state);

  for (const session of state.sessions) {
    totalsByTicket.set(
      session.ticketId,
      (totalsByTicket.get(session.ticketId) ?? 0) + session.durationMs
    );
  }

  const activeStatus = getActiveStatus(state, now);

  if (activeStatus) {
    totalsByTicket.set(
      activeStatus.ticketId,
      (totalsByTicket.get(activeStatus.ticketId) ?? 0) + activeStatus.elapsedMs
    );
  }

  const items = Array.from(totalsByTicket.entries()).map(([ticketId, durationMs]) => ({
    ticketId,
    durationMs
  }));
  const totalDurationMs = items.reduce((sum, item) => sum + item.durationMs, 0);

  return {
    items,
    totalDurationMs,
    ...syncSummary
  };
}

module.exports = {
  buildReport,
  getActiveStatus,
  getSyncSummary
};