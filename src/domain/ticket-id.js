function normalizeTicketId(value) {
  if (typeof value !== 'string') {
    throw new Error('A ticket ID is required.');
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('A ticket ID is required.');
  }

  const browseMatch = trimmedValue.match(/(?:^https?:\/\/[^/]+)?\/?browse\/([^/?#]+)/i);
  const normalizedValue = browseMatch ? browseMatch[1] : trimmedValue;

  return normalizedValue.trim().replace(/\/+$/g, '').toUpperCase();
}

module.exports = {
  normalizeTicketId
};