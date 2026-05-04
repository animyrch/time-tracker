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

async function invokeCli(args, { filePath, now }) {
  const stdout = [];
  const stderr = [];
  const exitCode = await runCli(args, {
    dataFilePath: filePath,
    now: () => now,
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
});

test('punch-in is accepted as an alias for start', async () => {
  const filePath = await createTempFilePath();

  const result = await invokeCli(['punch-in', 'PROJ-9'], {
    filePath,
    now: '2026-05-04T12:00:00.000Z'
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Started tracking PROJ-9/);
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

test('punch-out while idle succeeds with a readable message', async () => {
  const filePath = await createTempFilePath();

  const result = await invokeCli(['punch-out'], {
    filePath,
    now: '2026-05-04T12:00:00.000Z'
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /No active ticket to punch out/);
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