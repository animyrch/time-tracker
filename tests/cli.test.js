const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { runCli } = require('../src/cli/run');

async function createTempFilePath() {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'time-tracker-cli-'));
  return path.join(tempDirectory, 'state.json');
}

async function invokeCli(args, { filePath, now, worklogSync, env }) {
  const stdout = [];
  const stderr = [];
  const exitCode = await runCli(args, {
    dataFilePath: filePath,
    now: () => now,
    worklogSync,
    env,
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message)
  });

  return {
    exitCode,
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n')
  };
}

test('start creates an active ticket and status shows ticket details', async () => {
  const filePath = await createTempFilePath();

  const startResult = await invokeCli(['start', 'PROJ-1'], {
    filePath,
    now: '2026-05-04T09:00:00.000Z'
  });
  const statusResult = await invokeCli(['status'], {
    filePath,
    now: '2026-05-04T09:30:00.000Z'
  });

  assert.equal(startResult.exitCode, 0);
  assert.match(startResult.stdout, /Started tracking PROJ-1/);
  assert.equal(statusResult.exitCode, 0);
  assert.match(statusResult.stdout, /Current ticket: PROJ-1/);
  assert.match(statusResult.stdout, /Start time: 2026-05-04T09:00:00.000Z/);
  assert.match(statusResult.stdout, /Elapsed: 30m/);
  assert.match(statusResult.stdout, /Jira sync: disabled/);
  assert.match(statusResult.stdout, /Unsynced sessions: 0/);
});

test('switch closes the previous session and report shows aggregated totals', async () => {
  const filePath = await createTempFilePath();

  await invokeCli(['start', 'PROJ-1'], {
    filePath,
    now: '2026-05-04T09:00:00.000Z'
  });
  await invokeCli(['switch', 'PROJ-2'], {
    filePath,
    now: '2026-05-04T09:30:00.000Z'
  });
  const reportResult = await invokeCli(['report'], {
    filePath,
    now: '2026-05-04T09:45:00.000Z'
  });

  assert.equal(reportResult.exitCode, 0);
  assert.match(reportResult.stdout, /PROJ-1: 30m/);
  assert.match(reportResult.stdout, /PROJ-2: 15m/);
  assert.match(reportResult.stdout, /Total: 45m/);
  assert.match(reportResult.stdout, /Synced: 0m/);
  assert.match(reportResult.stdout, /Unsynced: 30m/);
  assert.match(reportResult.stdout, /Unsynced sessions: 1/);
});



test('CLI normalizes Jira browse URLs before tracking', async () => {
  const filePath = await createTempFilePath();

  const startResult = await invokeCli(['start', 'https://expondo.atlassian.net/browse/COM-608'], {
    filePath,
    now: '2026-05-04T12:00:00.000Z'
  });
  const statusResult = await invokeCli(['status'], {
    filePath,
    now: '2026-05-04T12:05:00.000Z'
  });

  assert.equal(startResult.exitCode, 0);
  assert.match(startResult.stdout, /Started tracking COM-608/);
  assert.equal(statusResult.exitCode, 0);
  assert.match(statusResult.stdout, /Current ticket: COM-608/);
});

test('pause while idle succeeds with a readable message', async () => {
  const filePath = await createTempFilePath();

  const result = await invokeCli(['pause'], {
    filePath,
    now: '2026-05-04T12:00:00.000Z'
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /No active ticket to pause/);
});



test('sync retries unsynced sessions and clears the queue', async () => {
  const filePath = await createTempFilePath();
  let shouldFail = true;
  const worklogSync = {
    isConfigured: true,
    async sendSession() {
      if (shouldFail) {
        throw new Error('Temporary Jira outage');
      }
    }
  };

  await invokeCli(['start', 'PROJ-10'], {
    filePath,
    now: '2026-05-04T15:00:00.000Z',
    worklogSync
  });
  await invokeCli(['pause'], {
    filePath,
    now: '2026-05-04T15:25:00.000Z',
    worklogSync
  });
  shouldFail = false;

  const syncResult = await invokeCli(['sync'], {
    filePath,
    now: '2026-05-04T15:30:00.000Z',
    worklogSync
  });
  const reportResult = await invokeCli(['report'], {
    filePath,
    now: '2026-05-04T15:30:00.000Z',
    worklogSync
  });

  assert.equal(syncResult.exitCode, 0);
  assert.match(syncResult.stdout, /Synced 1 session/);
  assert.match(syncResult.stdout, /Remaining unsynced sessions: 0/);
  assert.match(reportResult.stdout, /Synced: 25m/);
  assert.match(reportResult.stdout, /Unsynced: 0m/);
});

test('sync reports missing Jira configuration', async () => {
  const filePath = await createTempFilePath();

  const result = await invokeCli(['sync'], {
    filePath,
    now: '2026-05-04T16:00:00.000Z',
    env: {}
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Jira sync is not configured/);
});

test('unknown commands exit with an error and usage help', async () => {
  const filePath = await createTempFilePath();

  const result = await invokeCli(['unknown-command'], {
    filePath,
    now: '2026-05-04T12:00:00.000Z'
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Unknown command/);
  assert.match(result.stderr, /Available commands:/);
});