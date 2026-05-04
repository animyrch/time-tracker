const { toJiraWorklog } = require('./worklog-adapter');

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

function getConfigurationErrorMessage() {
  return 'Jira sync is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.';
}

function parseErrorMessage(bodyText, status) {
  if (!bodyText) {
    return `Jira request failed with status ${status}.`;
  }

  try {
    const parsed = JSON.parse(bodyText);

    if (Array.isArray(parsed.errorMessages) && parsed.errorMessages.length > 0) {
      return parsed.errorMessages.join(', ');
    }

    if (typeof parsed.message === 'string' && parsed.message.length > 0) {
      return parsed.message;
    }
  } catch (error) {
    return bodyText;
  }

  return `Jira request failed with status ${status}.`;
}

function createJiraClient({
  baseUrl,
  email,
  apiToken,
  fetchImpl = globalThis.fetch
}) {
  const normalizedBaseUrl = typeof baseUrl === 'string' && baseUrl.length > 0
    ? trimTrailingSlashes(baseUrl)
    : '';
  const isConfigured = Boolean(normalizedBaseUrl && email && apiToken);

  return {
    isConfigured,

    async sendWorklog(session) {
      if (!isConfigured) {
        throw new Error(getConfigurationErrorMessage());
      }

      const { issueKey, payload } = toJiraWorklog(session);
      const response = await fetchImpl(
        `${normalizedBaseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      const bodyText = typeof response.text === 'function' ? await response.text() : '';

      if (!response.ok) {
        throw new Error(parseErrorMessage(bodyText, response.status));
      }

      if (!bodyText) {
        return null;
      }

      try {
        return JSON.parse(bodyText);
      } catch (error) {
        return bodyText;
      }
    }
  };
}

module.exports = {
  createJiraClient,
  getConfigurationErrorMessage
};