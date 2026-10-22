const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  listWorkspaceDirectory,
  normalizeWorkspaceRoot,
  readWorkspaceFile,
  resolveWorkspacePath,
} = require('../dist/server/workspace/workspaceService.js');

const projectRoot = path.resolve(__dirname, '..');

test('normalizes a valid workspace directory', async () => {
  assert.equal(await normalizeWorkspaceRoot(projectRoot), projectRoot);
});

test('lists workspace entries with directories first', async () => {
  const entries = await listWorkspaceDirectory(projectRoot);
  const src = entries.find((entry) => entry.name === 'src');
  const packageFile = entries.find((entry) => entry.name === 'package.json');

  assert.equal(src?.type, 'directory');
  assert.equal(packageFile?.type, 'file');
  assert.ok(entries.indexOf(src) < entries.indexOf(packageFile));
});

test('rejects absolute and escaping workspace paths', async () => {
  await assert.rejects(resolveWorkspacePath(projectRoot, path.parse(projectRoot).root), /relative/);
  await assert.rejects(resolveWorkspacePath(projectRoot, '../'), /outside/);
});

test('reads a text file inside the workspace', async () => {
  const contents = await readWorkspaceFile(projectRoot, 'package.json');
  assert.match(contents, /"name": "creativemate-app"/);
});

