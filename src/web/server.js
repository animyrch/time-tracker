const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');

const { createWorklogSyncFromEnvironment } = require('../integrations/jira/worklog-sync');
const { createFileStateStore } = require('../storage/file-state-store');
const { createTracker } = require('../tracker');

const publicDirectoryPath = path.resolve(__dirname, 'public');
const dataFilePath = path.resolve(process.cwd(), 'data', 'tracker-state.json');
const worklogSync = createWorklogSyncFromEnvironment(process.env);
const store = createFileStateStore({ filePath: dataFilePath });
const tracker = createTracker({ store, worklogSync });

function resolvePort(value) {
  const parsed = Number.parseInt(value ?? '9999', 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 9999;
  }

  return parsed;
}

function createStatePayload(state) {
  return {
    ...state,
    serverNow: new Date().toISOString(),
    syncEnabled: worklogSync.isConfigured
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendText(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    'Content-Type': contentType
  });
  response.end(body);
}

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
}

function getContentType(filePath) {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }

  return 'text/html; charset=utf-8';
}

async function serveStaticAsset(response, fileName) {
  const filePath = path.join(publicDirectoryPath, fileName);
  const contents = await fs.readFile(filePath, 'utf8');
  sendText(response, 200, contents, getContentType(filePath));
}

function getRequiredTicketId(payload) {
  const ticketId = typeof payload?.ticketId === 'string' ? payload.ticketId.trim() : '';

  if (!ticketId) {
    throw new Error('A ticket ID is required.');
  }

  return ticketId;
}

async function handleAction(request, response, action) {
  const payload = await readJsonBody(request);
  let nextState;

  if (action === 'start') {
    nextState = await tracker.start(getRequiredTicketId(payload));
  } else if (action === 'switch') {
    nextState = await tracker.switch(getRequiredTicketId(payload));
  } else if (action === 'pause') {
    nextState = await tracker.pause();
  } else if (action === 'punch-out') {
    nextState = await tracker.punchOut();
  } else {
    sendJson(response, 404, { message: 'Route not found.' });
    return;
  }

  sendJson(response, 200, createStatePayload(nextState));
}

async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    await serveStaticAsset(response, 'index.html');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/styles.css') {
    await serveStaticAsset(response, 'styles.css');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/app.js') {
    await serveStaticAsset(response, 'app.js');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/state') {
    const state = await tracker.getState();
    sendJson(response, 200, createStatePayload(state));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/start') {
    await handleAction(request, response, 'start');
    return;
  }

  if (request.method === 'POST' && url.pathname === '/switch') {
    await handleAction(request, response, 'switch');
    return;
  }

  if (request.method === 'POST' && url.pathname === '/pause') {
    await handleAction(request, response, 'pause');
    return;
  }

  if (request.method === 'POST' && url.pathname === '/punch-out') {
    await handleAction(request, response, 'punch-out');
    return;
  }

  if (url.pathname === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 404, { message: 'Route not found.' });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const statusCode = error.message === 'A ticket ID is required.' || error.message === 'Request body must be valid JSON.'
      ? 400
      : 500;

    sendJson(response, statusCode, {
      message: error.message || 'Unexpected server error.'
    });
  });
});

const port = resolvePort(process.env.PORT);

server.listen(port, () => {
  console.log(`Time tracker web UI available at http://localhost:${port}`);
});