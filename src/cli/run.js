const path = require('node:path');

const { buildReport, getActiveStatus, getSyncSummary } = require('../domain/report');
const { createJiraClient } = require('../integrations/jira/client');
const { createFileStateStore } = require('../storage/file-state-store');
const { createTracker } = require('../tracker');

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  if (parts.length === 0) {
    parts.push(seconds > 0 ? `${seconds}s` : '0m');
  }

  return parts.join(' ');
}

function createUsageText() {
  return [
    'Available commands:',
    '  punch-in <ticket>',
    '  start <ticket>',
    '  switch <ticket>',
    '  pause',
    '  punch-out',
    '  sync',
    '  status',
    '  report'
  ].join('\n');
}

function createWorklogSyncFromEnvironment(env) {
  const client = createJiraClient({
    baseUrl: env.JIRA_BASE_URL,
    email: env.JIRA_EMAIL,
    apiToken: env.JIRA_API_TOKEN
  });

  return {
    isConfigured: client.isConfigured,
    async sendSession(session) {
      await client.sendWorklog(session);
    }
  };
}

async function runCli(args, {
  dataFilePath = path.resolve(process.cwd(), 'data', 'tracker-state.json'),
  now = () => new Date().toISOString(),
  env = process.env,
  worklogSync = createWorklogSyncFromEnvironment(env),
  stdout = (message) => console.log(message),
  stderr = (message) => console.error(message)
} = {}) {
  const store = createFileStateStore({ filePath: dataFilePath });
  const tracker = createTracker({ store, now, worklogSync });
  const [command, ...rest] = args;

  if (!command) {
    stderr(createUsageText());
    return 1;
  }

  if (command === 'start' || command === 'punch-in') {
    const ticketId = rest[0];

    if (!ticketId) {
      stderr('A ticket ID is required.');
      stderr(createUsageText());
      return 1;
    }

    await tracker.start(ticketId);
    stdout(`Started tracking ${ticketId}.`);
    return 0;
  }

  if (command === 'switch') {
    const ticketId = rest[0];

    if (!ticketId) {
      stderr('A ticket ID is required.');
      stderr(createUsageText());
      return 1;
    }

    await tracker.switch(ticketId);
    stdout(`Switched to ${ticketId}.`);
    return 0;
  }

  if (command === 'pause') {
    const state = await tracker.getState();

    if (!state.activeEntry) {
      stdout('No active ticket to pause.');
      return 0;
    }

    await tracker.pause();
    stdout(`Paused ${state.activeEntry.ticketId}.`);
    return 0;
  }

  if (command === 'punch-out') {
    const state = await tracker.getState();

    if (!state.activeEntry) {
      stdout('No active ticket to punch out.');
      return 0;
    }

    await tracker.punchOut();
    stdout(`Punched out from ${state.activeEntry.ticketId}.`);
    return 0;
  }

  if (command === 'status') {
    const state = await tracker.getState();
    const activeStatus = getActiveStatus(state, now());
    const syncSummary = getSyncSummary(state);

    if (activeStatus) {
      stdout(`Current ticket: ${activeStatus.ticketId}`);
      stdout(`Start time: ${activeStatus.startAt}`);
      stdout(`Elapsed: ${formatDuration(activeStatus.elapsedMs)}`);
    } else {
      stdout('No active ticket.');
    }

    stdout(`Jira sync: ${worklogSync.isConfigured ? 'enabled' : 'disabled'}`);
    stdout(`Unsynced sessions: ${syncSummary.unsyncedSessionCount}`);
    return 0;
  }

  if (command === 'sync') {
    if (!worklogSync.isConfigured) {
      stderr('Jira sync is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.');
      return 1;
    }

    const beforeState = await tracker.getState();
    const beforeSummary = getSyncSummary(beforeState);

    if (beforeSummary.unsyncedSessionCount === 0) {
      stdout('No unsynced sessions.');
      stdout('Remaining unsynced sessions: 0');
      return 0;
    }

    const syncedState = await tracker.syncUnsyncedSessions();
    const afterSummary = getSyncSummary(syncedState);
    const syncedCount = beforeSummary.unsyncedSessionCount - afterSummary.unsyncedSessionCount;

    stdout(`Synced ${syncedCount} session${syncedCount === 1 ? '' : 's'}.`);
    stdout(`Remaining unsynced sessions: ${afterSummary.unsyncedSessionCount}`);
    return 0;
  }

  if (command === 'report') {
    const state = await tracker.getState();
    const report = buildReport(state, now());

    if (report.items.length === 0) {
      stdout('No tracked time.');
      stdout('Total: 0m');
      stdout('Synced: 0m');
      stdout('Unsynced: 0m');
      stdout('Unsynced sessions: 0');
      return 0;
    }

    stdout('Time by ticket:');

    for (const item of report.items) {
      stdout(`${item.ticketId}: ${formatDuration(item.durationMs)}`);
    }

    stdout(`Total: ${formatDuration(report.totalDurationMs)}`);
    stdout(`Synced: ${formatDuration(report.syncedDurationMs)}`);
    stdout(`Unsynced: ${formatDuration(report.unsyncedDurationMs)}`);
    stdout(`Unsynced sessions: ${report.unsyncedSessionCount}`);
    return 0;
  }

  stderr(`Unknown command: ${command}`);
  stderr(createUsageText());
  return 1;
}

module.exports = {
  createWorklogSyncFromEnvironment,
  formatDuration,
  runCli
};