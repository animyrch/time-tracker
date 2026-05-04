const path = require('node:path');

const { buildReport, getActiveStatus } = require('../domain/report');
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
    '  status',
    '  report'
  ].join('\n');
}

async function runCli(args, {
  dataFilePath = path.resolve(process.cwd(), 'data', 'tracker-state.json'),
  now = () => new Date().toISOString(),
  stdout = (message) => console.log(message),
  stderr = (message) => console.error(message)
} = {}) {
  const store = createFileStateStore({ filePath: dataFilePath });
  const tracker = createTracker({ store, now });
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

    if (!activeStatus) {
      stdout('No active ticket.');
      return 0;
    }

    stdout(`Current ticket: ${activeStatus.ticketId}`);
    stdout(`Start time: ${activeStatus.startAt}`);
    stdout(`Elapsed: ${formatDuration(activeStatus.elapsedMs)}`);
    return 0;
  }

  if (command === 'report') {
    const state = await tracker.getState();
    const report = buildReport(state, now());

    if (report.items.length === 0) {
      stdout('No tracked time.');
      stdout('Total: 0m');
      return 0;
    }

    stdout('Time by ticket:');

    for (const item of report.items) {
      stdout(`${item.ticketId}: ${formatDuration(item.durationMs)}`);
    }

    stdout(`Total: ${formatDuration(report.totalDurationMs)}`);
    return 0;
  }

  stderr(`Unknown command: ${command}`);
  stderr(createUsageText());
  return 1;
}

module.exports = {
  formatDuration,
  runCli
};