const test = require('node:test');
const assert = require('node:assert/strict');

const { toJiraWorklog } = require('../src/integrations/jira/worklog-adapter');

test('toJiraWorklog maps a completed session to Jira worklog payload', () => {
  const result = toJiraWorklog({
    ticketId: 'PROJ-123',
    startAt: '2026-05-04T09:00:00.000Z',
    endAt: '2026-05-04T09:42:30.000Z',
    durationMs: 2550000,
    durationSeconds: 2550,
    synced: false,
    syncError: null
  });

  assert.deepEqual(result, {
    issueKey: 'PROJ-123',
    payload: {
      started: '2026-05-04T09:00:00.000+0000',
      timeSpentSeconds: 2550,
      comment: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Logged with local time-tracker CLI.'
              }
            ]
          }
        ]
      }
    }
  });
});