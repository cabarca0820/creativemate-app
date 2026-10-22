const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  createTestingProject,
  normalizeProjectName,
  parseContextItems,
  parseConversationMemory,
  parseProjectState,
} = require('../dist/server/projects/projectService.js');

test('normalizes a concise project name', () => {
  assert.equal(normalizeProjectName('  Checkout   Web  '), 'Checkout Web');
});

test('rejects an empty or oversized project name', () => {
  assert.throws(() => normalizeProjectName('   '), /Enter a project name/);
  assert.throws(() => normalizeProjectName('x'.repeat(81)), /80 characters/);
});

test('creates a project with empty requirements', () => {
  const root = path.resolve(__dirname, '..');
  const project = createTestingProject('project-1', 'Checkout Web', root, '2026-10-11T00:00:00.000Z');
  assert.equal(project.name, 'Checkout Web');
  assert.equal(project.workspaceRoot, root);
  assert.equal(project.requirementsMarkdown, '');
  assert.deepEqual(project.contextItems, []);
  assert.deepEqual(project.conversationMemory, []);
  assert.equal(project.createdAt, project.updatedAt);
});

test('restores a valid active project and rejects malformed records', () => {
  const root = path.resolve(__dirname, '..');
  const valid = createTestingProject('project-1', 'Checkout Web', root);
  const state = parseProjectState({
    activeProjectId: valid.id,
    projects: [valid, { id: 'broken' }],
  });
  assert.deepEqual(state.projects, [valid]);
  assert.equal(state.activeProjectId, valid.id);
});

test('validates focused context and conversation memory', () => {
  const context = parseContextItems([{
    id: 'context-1',
    kind: 'requirement',
    title: '  US-014  ',
    content: '  A user can reset a password.  ',
    enabled: true,
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  }, { id: 'invalid' }]);
  assert.equal(context.length, 1);
  assert.equal(context[0].title, 'US-014');

  const memory = parseConversationMemory([{
    id: 'message-1',
    skill: 'test_case_generation',
    role: 'user',
    content: '  Cover the locked-account state.  ',
    enabled: false,
    createdAt: '2026-10-12T00:00:00.000Z',
  }]);
  assert.equal(memory[0].content, 'Cover the locked-account state.');
  assert.equal(memory[0].enabled, false);
});
