function normalizeTicketId(value) {
  if (typeof value !== 'string') {
    throw new Error('A ticket ID is required.');
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('A ticket ID is required.');
  }

  // Extract from Jira URL if present
  const browseMatch = trimmedValue.match(/(?:^https?:\/\/[^/]+)?\/?browse\/([^/?#]+)/i);
  let normalizedValue = browseMatch ? browseMatch[1] : trimmedValue;

  // If only a number is provided, prepend default project key
  if (/^\d+$/.test(normalizedValue)) {
    normalizedValue = `COM-${normalizedValue}`;
  }

  return normalizedValue.trim().replace(/\/+$/g, '').toUpperCase();
}

module.exports = {
  normalizeTicketId
};