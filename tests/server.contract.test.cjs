const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { ElectronServer } = require('../dist/server/server/server.js');

const token = 'contract-test-token';
let server;
let baseUrl;

test.before(async () => {
  server = new ElectronServer({
    apiToken: token,
    pythonExecutable: process.execPath,
    pythonScriptPath: path.join(__dirname, 'fixtures', 'fake-python.cjs'),
    dataDirectory: path.join(__dirname, '.test-data'),
  });
  const port = await server.start();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await server.stop();
});

test('rejects requests without the per-launch API token', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 401);
});

test('reports local-only health through the authenticated interface', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { 'X-CreativeMate-Token': token },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, 'local-only');
});

test('preserves the prompt SSE contract', async () => {
  const form = new FormData();
  form.append('prompt', 'A user can reset a password');
  form.append('messages', '[]');
  form.append('images', '[]');
  form.append('contextItems', JSON.stringify([{
    kind: 'requirement',
    title: 'Password reset',
    content: 'The reset link expires after 15 minutes.',
  }]));

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'X-CreativeMate-Token': token },
    body: form,
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/event-stream/);

  const events = body.trim().split(/\r?\n\r?\n/).map((block) => {
    assert.match(block, /^data: /);
    return JSON.parse(block.slice(6));
  });

  assert.deepEqual(events.map((event) => event.type), ['chunk', 'chunk', 'complete']);
  assert.equal(events.filter((event) => event.type === 'chunk').map((event) => event.content).join(''), 'QA analysis');
});

test('passes the selected document creation skill to the local model', async () => {
  const form = new FormData();
  form.append('prompt', 'Create concise release notes');
  form.append('messages', '[]');
  form.append('images', '[]');
  form.append('skill', 'document_creation');

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'X-CreativeMate-Token': token },
    body: form,
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  const content = body.trim().split(/\r?\n\r?\n/)
    .map((block) => JSON.parse(block.slice(6)))
    .filter((event) => event.type === 'chunk')
    .map((event) => event.content)
    .join('');
  assert.equal(content, '# Lean document');
});

test('rejects unsupported skills', async () => {
  const form = new FormData();
  form.append('prompt', 'Run an unknown workflow');
  form.append('messages', '[]');
  form.append('images', '[]');
  form.append('skill', 'shell_access');

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'X-CreativeMate-Token': token },
    body: form,
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Unsupported skill');
});

test('rejects non-PDF document uploads without hanging', async () => {
  const form = new FormData();
  form.append('document', new Blob(['not a pdf'], { type: 'text/plain' }), 'notes.txt');

  const response = await fetch(`${baseUrl}/upload-document`, {
    method: 'POST',
    headers: { 'X-CreativeMate-Token': token },
    body: form,
  });

  assert.equal(response.status, 400);
});

test('preserves the transcription response contract', async () => {
  const form = new FormData();
  form.append('audio', new Blob(['audio'], { type: 'audio/webm' }), 'recording.webm');

  const response = await fetch(`${baseUrl}/transcribe-audio`, {
    method: 'POST',
    headers: { 'X-CreativeMate-Token': token },
    body: form,
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.transcribedText, 'Transcribed requirement');
});
