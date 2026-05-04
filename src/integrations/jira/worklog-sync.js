const { createJiraClient } = require('./client');

function createWorklogSyncFromEnvironment(env = process.env) {
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

module.exports = {
  createWorklogSyncFromEnvironment
};