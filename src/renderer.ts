import './index.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

type MessageRole = 'user' | 'assistant';
type SkillId = 'test_case_generation' | 'document_creation';

interface StreamEvent {
  type: 'transcription' | 'chunk' | 'error' | 'complete';
  content?: string;
}

const root = document.querySelector<HTMLDivElement>('#root');

if (!root) {
  throw new Error('Application root element was not found');
}

root.innerHTML = `
  <div class="ide-shell">
    <header class="title-bar">
      <div class="title-brand">CreativeMate Testing Workspace</div>
      <button id="workspace-title" class="workspace-title" type="button" title="Choose workspace">No workspace open</button>
      <div id="service-status" class="service-status"><span class="status-dot checking"></span> Checking local API…</div>
    </header>

    <div id="ide-body" class="ide-body">
      <nav class="activity-rail" aria-label="Workspace views">
        <button id="explorer-toggle" class="activity-button active" type="button" aria-label="Toggle explorer" title="Explorer">▱</button>
        <button id="assistant-focus" class="activity-button" type="button" aria-label="Focus AI assistant" title="AI assistant">✦</button>
        <button id="terminal-toggle" class="activity-button" type="button" aria-label="Toggle terminal" title="Terminal">›_</button>
      </nav>

      <aside id="explorer-panel" class="explorer-panel" aria-label="Projects and workspace explorer">
        <div class="panel-heading projects-heading">
          <span>PROJECTS</span>
          <button id="new-project" class="new-project-button" type="button">＋ New project</button>
        </div>
        <div id="project-list" class="project-list" aria-label="Testing projects"></div>

        <div class="panel-heading explorer-heading">
          <span>EXPLORER</span>
          <button id="refresh-workspace" class="toolbar-button" type="button" title="Refresh project files" disabled>↻</button>
        </div>
        <div id="workspace-path" class="workspace-path">Create a project to choose its application folder.</div>
        <div id="file-tree" class="file-tree" role="tree" aria-label="Workspace files"></div>

        <section class="context-section">
          <div class="panel-heading context-heading"><span>AI CONTEXT</span></div>
          <p>Index a local PDF specification for the assistant.</p>
          <label class="file-label" for="document-input">Choose PDF</label>
          <input id="document-input" type="file" accept="application/pdf,.pdf" />
          <button id="upload-button" class="secondary-button" type="button" disabled>Index document</button>
          <p id="upload-status" class="status-message" role="status"></p>
        </section>
      </aside>

      <main class="workbench">
        <section class="project-workspace" aria-label="Project workspace">
          <div class="workspace-tabs" role="tablist" aria-label="Project views">
            <button id="requirements-tab" class="workspace-tab active" type="button" role="tab" aria-selected="true">Requirements</button>
            <button id="tools-tab" class="workspace-tab" type="button" role="tab" aria-selected="false">Tools</button>
          </div>

          <section id="requirements-view" class="workspace-view requirements-view" role="tabpanel">
            <div class="requirements-toolbar">
              <div>
                <h1 id="requirements-title">Requirements</h1>
                <span id="requirements-source">No Markdown file imported</span>
              </div>
              <button id="import-requirements" class="secondary-button compact-button" type="button" disabled>Import Markdown</button>
            </div>
            <article id="requirements-content" class="requirements-content">
              <div class="compact-empty-state">
                <strong>No requirements loaded</strong>
                <span>Create a project, then import a Markdown requirements file.</span>
              </div>
            </article>
          </section>

          <section id="tools-view" class="workspace-view tools-view" role="tabpanel" hidden>
            <section id="file-preview-panel" class="file-preview-panel collapsed" aria-label="File preview">
              <div class="editor-tab-bar">
                <div id="preview-tab" class="editor-tab">File preview</div>
                <button id="close-preview" class="toolbar-button" type="button" title="Close file preview">×</button>
              </div>
              <div id="file-preview" class="file-preview"></div>
            </section>
            <section id="terminal-panel" class="terminal-panel" aria-label="Integrated terminal">
              <div class="terminal-toolbar">
                <span>TERMINAL</span>
                <button id="restart-terminal" class="toolbar-button" type="button" title="Restart terminal">↻</button>
              </div>
              <div id="terminal-container" class="terminal-container"></div>
            </section>
          </section>
        </section>

          <section class="chat-panel" aria-label="AI assistant">
            <div class="panel-heading assistant-heading">
              <span>AI ASSISTANT</span>
              <button id="context-toggle" class="context-toggle" type="button" aria-expanded="false">Context · 0</button>
            </div>
            <div id="messages" class="messages" aria-live="polite">
              <article class="message assistant-message">
                <div class="message-label">QA assistant</div>
                <div class="message-content">Choose a skill, then describe the requirement or document you want to create.</div>
              </article>
            </div>

            <form id="prompt-form" class="composer">
              <div class="skill-control">
                <label for="skill-select">Skill</label>
                <select id="skill-select">
                  <option value="test_case_generation">Lean Given–When–Then test cases</option>
                  <option value="document_creation">Concise Markdown document</option>
                </select>
              </div>
              <label for="prompt-input" class="sr-only">Requirement or testing request</label>
              <textarea id="prompt-input" rows="4" placeholder="Describe a requirement or testing request."></textarea>
              <div id="recording-status" class="recording-status" role="status"></div>
              <div class="composer-actions">
                <button id="microphone-button" class="icon-button" type="button" aria-pressed="false">● Record</button>
                <div class="right-actions">
                  <button id="clear-button" class="text-button" type="button">Clear</button>
                  <button id="send-button" class="primary-button" type="submit">Generate tests</button>
                </div>
              </div>
            </form>

            <section id="context-manager" class="context-manager" aria-label="Context sent to model" hidden>
              <div class="context-manager-header">
                <div>
                  <h2>Context sent to model</h2>
                  <p>Only checked items are included in the next request.</p>
                </div>
                <strong id="context-estimate">0 characters</strong>
              </div>

              <div class="context-section-block">
                <div class="context-section-heading">
                  <div><h3>Focused context</h3><span>Specific user stories, rules, or durable notes.</span></div>
                  <button id="add-context" class="secondary-button compact-button" type="button">＋ Add context</button>
                </div>
                <div id="focused-context-list" class="context-item-list"></div>
              </div>

              <div class="context-section-block memory-block">
                <div class="context-section-heading">
                  <div><h3>Conversation memory</h3><span>Recent messages for the selected skill.</span></div>
                  <button id="clear-memory" class="text-button danger-text" type="button">Clear conversation</button>
                </div>
                <div id="conversation-memory-list" class="context-item-list"></div>
              </div>

              <div class="context-manager-actions">
                <button id="close-context" class="text-button" type="button">Back to chat</button>
              </div>
            </section>
          </section>
      </main>
    </div>

    <footer class="status-bar">
      <span id="workspace-status">No workspace open</span>
      <span id="terminal-status">Terminal waiting for a workspace</span>
      <span>Local-only</span>
    </footer>
  </div>

  <dialog id="project-dialog" class="project-dialog">
    <form id="project-form" method="dialog">
      <h2>Create testing project</h2>
      <p>Each project represents one application under test.</p>
      <label for="project-name">Project name</label>
      <input id="project-name" name="project-name" maxlength="80" autocomplete="off" placeholder="Example: Checkout Web" required />
      <div class="dialog-actions">
        <button id="cancel-project" class="text-button" type="button">Cancel</button>
        <button class="primary-button" type="submit">Choose application folder</button>
      </div>
    </form>
  </dialog>

  <dialog id="context-editor-dialog" class="project-dialog context-editor-dialog">
    <form id="context-editor-form" method="dialog">
      <h2 id="context-editor-title">Add focused context</h2>
      <p id="context-editor-help">Add only the requirement or memory needed for the next test task.</p>
      <label id="context-kind-label" for="context-kind">Context type</label>
      <select id="context-kind">
        <option value="requirement">Focused requirement</option>
        <option value="memory">Memory note</option>
      </select>
      <label id="context-title-label" for="context-title-input">Title</label>
      <input id="context-title-input" maxlength="120" autocomplete="off" placeholder="Example: US-014 — Reset password" required />
      <label for="context-content-input">Content</label>
      <textarea id="context-content-input" maxlength="20000" rows="9" placeholder="Paste the focused user story, acceptance criteria, or testing note." required></textarea>
      <div class="dialog-actions">
        <button id="cancel-context-editor" class="text-button" type="button">Cancel</button>
        <button class="primary-button" type="submit">Save context</button>
      </div>
    </form>
  </dialog>
`;

const elements = {
  form: getElement<HTMLFormElement>('prompt-form'),
  skill: getElement<HTMLSelectElement>('skill-select'),
  prompt: getElement<HTMLTextAreaElement>('prompt-input'),
  messages: getElement<HTMLDivElement>('messages'),
  send: getElement<HTMLButtonElement>('send-button'),
  clear: getElement<HTMLButtonElement>('clear-button'),
  microphone: getElement<HTMLButtonElement>('microphone-button'),
  recordingStatus: getElement<HTMLDivElement>('recording-status'),
  documentInput: getElement<HTMLInputElement>('document-input'),
  upload: getElement<HTMLButtonElement>('upload-button'),
  uploadStatus: getElement<HTMLParagraphElement>('upload-status'),
  serviceStatus: getElement<HTMLParagraphElement>('service-status'),
  workspaceTitle: getElement<HTMLButtonElement>('workspace-title'),
  workspacePath: getElement<HTMLDivElement>('workspace-path'),
  workspaceStatus: getElement<HTMLSpanElement>('workspace-status'),
  terminalStatus: getElement<HTMLSpanElement>('terminal-status'),
  newProject: getElement<HTMLButtonElement>('new-project'),
  projectList: getElement<HTMLDivElement>('project-list'),
  projectDialog: getElement<HTMLDialogElement>('project-dialog'),
  projectForm: getElement<HTMLFormElement>('project-form'),
  projectName: getElement<HTMLInputElement>('project-name'),
  cancelProject: getElement<HTMLButtonElement>('cancel-project'),
  refreshWorkspace: getElement<HTMLButtonElement>('refresh-workspace'),
  fileTree: getElement<HTMLDivElement>('file-tree'),
  filePreview: getElement<HTMLDivElement>('file-preview'),
  previewTab: getElement<HTMLDivElement>('preview-tab'),
  explorerPanel: getElement<HTMLElement>('explorer-panel'),
  ideBody: getElement<HTMLDivElement>('ide-body'),
  explorerToggle: getElement<HTMLButtonElement>('explorer-toggle'),
  assistantFocus: getElement<HTMLButtonElement>('assistant-focus'),
  terminalToggle: getElement<HTMLButtonElement>('terminal-toggle'),
  requirementsTab: getElement<HTMLButtonElement>('requirements-tab'),
  toolsTab: getElement<HTMLButtonElement>('tools-tab'),
  requirementsView: getElement<HTMLElement>('requirements-view'),
  toolsView: getElement<HTMLElement>('tools-view'),
  requirementsTitle: getElement<HTMLHeadingElement>('requirements-title'),
  requirementsSource: getElement<HTMLSpanElement>('requirements-source'),
  requirementsContent: getElement<HTMLElement>('requirements-content'),
  importRequirements: getElement<HTMLButtonElement>('import-requirements'),
  filePreviewPanel: getElement<HTMLElement>('file-preview-panel'),
  closePreview: getElement<HTMLButtonElement>('close-preview'),
  terminalPanel: getElement<HTMLElement>('terminal-panel'),
  terminalContainer: getElement<HTMLDivElement>('terminal-container'),
  restartTerminal: getElement<HTMLButtonElement>('restart-terminal'),
  contextToggle: getElement<HTMLButtonElement>('context-toggle'),
  contextManager: getElement<HTMLElement>('context-manager'),
  contextEstimate: getElement<HTMLElement>('context-estimate'),
  addContext: getElement<HTMLButtonElement>('add-context'),
  focusedContextList: getElement<HTMLDivElement>('focused-context-list'),
  conversationMemoryList: getElement<HTMLDivElement>('conversation-memory-list'),
  clearMemory: getElement<HTMLButtonElement>('clear-memory'),
  closeContext: getElement<HTMLButtonElement>('close-context'),
  contextEditorDialog: getElement<HTMLDialogElement>('context-editor-dialog'),
  contextEditorForm: getElement<HTMLFormElement>('context-editor-form'),
  contextEditorTitle: getElement<HTMLHeadingElement>('context-editor-title'),
  contextEditorHelp: getElement<HTMLParagraphElement>('context-editor-help'),
  contextKindLabel: getElement<HTMLLabelElement>('context-kind-label'),
  contextKind: getElement<HTMLSelectElement>('context-kind'),
  contextTitleLabel: getElement<HTMLLabelElement>('context-title-label'),
  contextTitleInput: getElement<HTMLInputElement>('context-title-input'),
  contextContentInput: getElement<HTMLTextAreaElement>('context-content-input'),
  cancelContextEditor: getElement<HTMLButtonElement>('cancel-context-editor'),
};

let selectedDocument: File | null = null;
let mediaRecorder: MediaRecorder | null = null;
let microphoneStream: MediaStream | null = null;
let audioChunks: Blob[] = [];
let recordedAudio: Blob | null = null;
let requestInProgress = false;
let recordingInProgress = false;
let transcriptionInProgress = false;
let currentWorkspace: WorkspaceInfo | null = null;
let currentProject: TestingProject | null = null;
let projects: TestingProject[] = [];
let terminalRunning = false;
let contextEditorTarget: { type: 'context' | 'message'; id?: string } | null = null;

const terminal = new Terminal({
  allowProposedApi: false,
  convertEol: true,
  cursorBlink: true,
  fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
  fontSize: 13,
  lineHeight: 1.25,
  scrollback: 5_000,
  theme: {
    background: '#09111f',
    foreground: '#d8e2f2',
    cursor: '#69d7c5',
    selectionBackground: '#315a78aa',
    black: '#101827',
    red: '#ff7385',
    green: '#54df9b',
    yellow: '#f4c967',
    blue: '#64a8ff',
    magenta: '#cb8cff',
    cyan: '#68d7c5',
    white: '#e8edf7',
  },
});
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(elements.terminalContainer);

function requireElectronApi(): ElectronAPI {
  if (!window.electronAPI) throw new Error('Electron API is unavailable');
  return window.electronAPI;
}

function fitTerminal(): void {
  if (elements.toolsView.hidden) return;
  try {
    fitAddon.fit();
    if (terminalRunning) {
      requireElectronApi().resizeTerminal({ cols: terminal.cols, rows: terminal.rows });
    }
  } catch {
    // The panel can briefly have no dimensions while the window is resizing.
  }
}

async function startTerminal(): Promise<void> {
  if (!currentWorkspace) {
    terminalRunning = false;
    terminal.reset();
    terminal.writeln('\x1b[38;5;245mCreate or select a project to start the terminal.\x1b[0m');
    elements.terminalStatus.textContent = 'Terminal waiting for a project';
    return;
  }

  terminal.reset();
  terminal.writeln(`\x1b[38;5;245mStarting terminal in ${currentWorkspace.root}…\x1b[0m`);
  fitTerminal();
  try {
    const result = await requireElectronApi().startTerminal({ cols: terminal.cols, rows: terminal.rows });
    terminalRunning = true;
    elements.terminalStatus.textContent = `${result.shell} · ${currentWorkspace.name}`;
    terminal.focus();
  } catch (error) {
    terminalRunning = false;
    const message = error instanceof Error ? error.message : 'Unable to start terminal';
    terminal.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
    elements.terminalStatus.textContent = 'Terminal unavailable';
  }
}

function createTreeRow(entry: WorkspaceEntry, level: number): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = `tree-row ${entry.type}`;
  row.style.setProperty('--tree-depth', String(level));
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-level', String(level + 1));

  const marker = document.createElement('span');
  marker.className = 'tree-marker';
  marker.textContent = entry.type === 'directory' ? '›' : entry.type === 'symlink' ? '↗' : '·';
  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = entry.name;
  row.append(marker, label);
  return row;
}

async function previewWorkspaceFile(entry: WorkspaceEntry): Promise<void> {
  setWorkbenchTab('tools');
  elements.filePreviewPanel.classList.remove('collapsed');
  elements.previewTab.textContent = entry.name;
  elements.filePreview.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'preview-notice';
  loading.textContent = `Opening ${entry.relativePath}…`;
  elements.filePreview.append(loading);

  try {
    const contents = await requireElectronApi().readWorkspaceFile(entry.relativePath);
    const pre = document.createElement('pre');
    pre.className = 'source-preview';
    const code = document.createElement('code');
    code.textContent = contents;
    pre.append(code);
    elements.filePreview.replaceChildren(pre);
    elements.workspaceStatus.textContent = entry.relativePath;
  } catch (error) {
    loading.textContent = error instanceof Error ? error.message : 'This file cannot be previewed';
  }
}

async function appendDirectory(relativePath: string, parent: HTMLElement, level: number): Promise<void> {
  const entries = await requireElectronApi().listWorkspaceDirectory(relativePath);
  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    const row = createTreeRow(entry, level);
    item.append(row);
    parent.append(item);

    if (entry.type === 'directory') {
      row.setAttribute('aria-expanded', 'false');
      row.addEventListener('click', async () => {
        const expanded = row.getAttribute('aria-expanded') === 'true';
        row.setAttribute('aria-expanded', String(!expanded));
        const marker = row.querySelector<HTMLElement>('.tree-marker');
        if (marker) marker.textContent = expanded ? '›' : '⌄';

        let children = item.querySelector<HTMLElement>(':scope > .tree-children');
        if (!children) {
          children = document.createElement('div');
          children.className = 'tree-children';
          item.append(children);
          try {
            await appendDirectory(entry.relativePath, children, level + 1);
          } catch (error) {
            const message = document.createElement('div');
            message.className = 'tree-error';
            message.textContent = error instanceof Error ? error.message : 'Unable to open folder';
            children.append(message);
          }
        }
        children.hidden = expanded;
      });
    } else if (entry.type === 'file') {
      row.addEventListener('click', () => void previewWorkspaceFile(entry));
    } else {
      row.disabled = true;
      row.title = 'Symbolic links are not followed outside the workspace boundary';
    }
  }
}

async function refreshWorkspace(): Promise<void> {
  elements.fileTree.replaceChildren();
  if (!currentWorkspace) return;
  try {
    await appendDirectory('', elements.fileTree, 0);
  } catch (error) {
    const message = document.createElement('div');
    message.className = 'tree-error root-error';
    message.textContent = error instanceof Error ? error.message : 'Unable to read workspace';
    elements.fileTree.append(message);
  }
}

async function loadWorkspace(workspace: WorkspaceInfo, restartTerminal = true): Promise<void> {
  currentWorkspace = workspace;
  elements.workspaceTitle.textContent = workspace.name;
  elements.workspaceTitle.title = workspace.root;
  elements.workspacePath.textContent = workspace.root;
  elements.workspaceStatus.textContent = workspace.name;
  elements.refreshWorkspace.disabled = false;
  await refreshWorkspace();
  if (restartTerminal) await startTerminal();
}

function renderRequirements(project: TestingProject | null): void {
  elements.requirementsTitle.textContent = project ? `${project.name} requirements` : 'Requirements';
  elements.requirementsSource.textContent = project?.requirementsSourceName ?? 'No Markdown file imported';
  elements.importRequirements.disabled = !project;

  if (project?.requirementsMarkdown.trim()) {
    renderMarkdown(elements.requirementsContent, project.requirementsMarkdown);
    return;
  }

  elements.requirementsContent.innerHTML = `
    <div class="compact-empty-state">
      <strong>No requirements loaded</strong>
      <span>${project ? 'Import a Markdown file to populate this project’s requirements.' : 'Create a project, then import a Markdown requirements file.'}</span>
    </div>
  `;
}

function selectedConversationMemory(): ProjectConversationMessage[] {
  if (!currentProject) return [];
  const skill = getSelectedSkill();
  return currentProject.conversationMemory.filter((message) => message.skill === skill);
}

function renderConversation(): void {
  elements.messages.replaceChildren();
  addMessage('assistant', 'Choose a skill, then describe the focused requirement or testing task.');
  for (const message of selectedConversationMemory()) addMessage(message.role, message.content);
}

function updateProjectReference(project: TestingProject): void {
  currentProject = project;
  projects = projects.map((candidate) => candidate.id === project.id ? project : candidate);
  renderProjectList();
}

async function persistProjectAiState(): Promise<void> {
  if (!currentProject) return;
  const updated = await requireElectronApi().updateProjectAiState(currentProject.id, {
    contextItems: currentProject.contextItems,
    conversationMemory: currentProject.conversationMemory,
  });
  updateProjectReference(updated);
  renderContextManager();
}

function contextActionButton(label: string, className: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function contextCheckbox(checked: boolean, label: string, onChange: (checked: boolean) => void): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.setAttribute('aria-label', label);
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  return checkbox;
}

function emptyContextNotice(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.className = 'context-empty';
  element.textContent = text;
  return element;
}

function renderFocusedContext(): void {
  elements.focusedContextList.replaceChildren();
  if (!currentProject?.contextItems.length) {
    elements.focusedContextList.append(emptyContextNotice('No focused context yet. Add one user story or testing note.'));
    return;
  }

  for (const item of currentProject.contextItems) {
    const row = document.createElement('article');
    row.className = 'context-item-row';
    const checkbox = contextCheckbox(item.enabled, `Include ${item.title}`, (enabled) => {
      item.enabled = enabled;
      void persistProjectAiState();
    });
    const content = document.createElement('div');
    content.className = 'context-item-copy';
    const meta = document.createElement('span');
    meta.textContent = item.kind === 'requirement' ? 'Focused requirement' : 'Memory note';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const preview = document.createElement('p');
    preview.textContent = item.content;
    content.append(meta, title, preview);
    const actions = document.createElement('div');
    actions.className = 'context-row-actions';
    actions.append(
      contextActionButton('Edit', 'context-link-button', () => openContextEditor('context', item.id)),
      contextActionButton('Delete', 'context-link-button danger-text', () => void deleteContextItem(item.id)),
    );
    row.append(checkbox, content, actions);
    elements.focusedContextList.append(row);
  }
}

function renderConversationMemory(): void {
  elements.conversationMemoryList.replaceChildren();
  const messages = selectedConversationMemory();
  if (!messages.length) {
    elements.conversationMemoryList.append(emptyContextNotice('No conversation memory for this skill.'));
    return;
  }

  for (const message of messages) {
    const row = document.createElement('article');
    row.className = 'context-item-row memory-row';
    const checkbox = contextCheckbox(message.enabled, `Include ${message.role} message`, (enabled) => {
      message.enabled = enabled;
      void persistProjectAiState();
    });
    const content = document.createElement('div');
    content.className = 'context-item-copy';
    const meta = document.createElement('span');
    meta.textContent = message.role === 'user' ? 'You' : 'QA assistant';
    const preview = document.createElement('p');
    preview.textContent = message.content;
    content.append(meta, preview);
    const actions = document.createElement('div');
    actions.className = 'context-row-actions';
    actions.append(
      contextActionButton('Edit', 'context-link-button', () => openContextEditor('message', message.id)),
      contextActionButton('Delete', 'context-link-button danger-text', () => void deleteConversationMessage(message.id)),
    );
    row.append(checkbox, content, actions);
    elements.conversationMemoryList.append(row);
  }
}

function renderContextManager(): void {
  const enabledContext = currentProject?.contextItems.filter((item) => item.enabled) ?? [];
  const enabledMemory = selectedConversationMemory().filter((message) => message.enabled);
  const selectedCharacters = [...enabledContext, ...enabledMemory]
    .reduce((total, item) => total + item.content.length, 0);
  elements.contextEstimate.textContent = `${selectedCharacters.toLocaleString()} selected characters`;
  elements.contextToggle.textContent = `Context · ${enabledContext.length + enabledMemory.length}`;
  elements.addContext.disabled = !currentProject;
  elements.clearMemory.disabled = !enabledMemory.length && !selectedConversationMemory().length;
  renderFocusedContext();
  renderConversationMemory();
}

function openContextEditor(type: 'context' | 'message', id?: string): void {
  if (!currentProject) return;
  contextEditorTarget = { type, id };
  const contextItem = type === 'context' && id
    ? currentProject.contextItems.find((item) => item.id === id)
    : undefined;
  const message = type === 'message' && id
    ? currentProject.conversationMemory.find((item) => item.id === id)
    : undefined;
  const editingMessage = type === 'message';
  elements.contextEditorTitle.textContent = editingMessage ? 'Edit conversation memory' : contextItem ? 'Edit focused context' : 'Add focused context';
  elements.contextEditorHelp.textContent = editingMessage
    ? 'Correct this remembered message or exclude it from future requests.'
    : 'Add only the requirement or durable note needed for the test task.';
  elements.contextKindLabel.hidden = editingMessage;
  elements.contextKind.hidden = editingMessage;
  elements.contextTitleLabel.hidden = editingMessage;
  elements.contextTitleInput.hidden = editingMessage;
  elements.contextKind.value = contextItem?.kind ?? 'requirement';
  elements.contextTitleInput.value = contextItem?.title ?? '';
  elements.contextContentInput.value = contextItem?.content ?? message?.content ?? '';
  elements.contextEditorDialog.showModal();
  requestAnimationFrame(() => (editingMessage ? elements.contextContentInput : elements.contextTitleInput).focus());
}

async function saveContextEditor(): Promise<void> {
  if (!currentProject || !contextEditorTarget) return;
  const content = elements.contextContentInput.value.trim();
  if (!content) return;
  if (contextEditorTarget.type === 'message' && contextEditorTarget.id) {
    const message = currentProject.conversationMemory.find((item) => item.id === contextEditorTarget?.id);
    if (message) message.content = content;
  } else {
    const title = elements.contextTitleInput.value.trim();
    if (!title) return;
    const existing = contextEditorTarget.id
      ? currentProject.contextItems.find((item) => item.id === contextEditorTarget?.id)
      : undefined;
    const now = new Date().toISOString();
    if (existing) {
      existing.kind = elements.contextKind.value === 'memory' ? 'memory' : 'requirement';
      existing.title = title;
      existing.content = content;
      existing.updatedAt = now;
    } else {
      currentProject.contextItems.push({
        id: crypto.randomUUID(),
        kind: elements.contextKind.value === 'memory' ? 'memory' : 'requirement',
        title,
        content,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await persistProjectAiState();
  elements.contextEditorDialog.close();
  contextEditorTarget = null;
}

async function deleteContextItem(id: string): Promise<void> {
  if (!currentProject || !window.confirm('Delete this focused context item?')) return;
  currentProject.contextItems = currentProject.contextItems.filter((item) => item.id !== id);
  await persistProjectAiState();
}

async function deleteConversationMessage(id: string): Promise<void> {
  if (!currentProject || !window.confirm('Delete this message from conversation memory?')) return;
  currentProject.conversationMemory = currentProject.conversationMemory.filter((message) => message.id !== id);
  await persistProjectAiState();
  renderConversation();
}

async function clearSelectedConversation(): Promise<void> {
  if (!currentProject || !window.confirm('Clear conversation memory for the selected skill?')) return;
  const skill = getSelectedSkill();
  currentProject.conversationMemory = currentProject.conversationMemory.filter((message) => message.skill !== skill);
  await persistProjectAiState();
  renderConversation();
}

function renderProjectList(): void {
  elements.projectList.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement('p');
    empty.className = 'project-list-empty';
    empty.textContent = 'No testing projects yet.';
    elements.projectList.append(empty);
    return;
  }

  for (const project of projects) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-row';
    button.classList.toggle('active', project.id === currentProject?.id);
    button.setAttribute('aria-current', project.id === currentProject?.id ? 'true' : 'false');

    const marker = document.createElement('span');
    marker.className = 'project-marker';
    marker.textContent = '◫';
    const copy = document.createElement('span');
    copy.className = 'project-copy';
    const name = document.createElement('strong');
    name.textContent = project.name;
    const folder = document.createElement('small');
    folder.textContent = project.workspaceRoot.split(/[\\/]/).pop() || project.workspaceRoot;
    copy.append(name, folder);
    button.append(marker, copy);
    button.addEventListener('click', () => void activateProject(project.id));
    elements.projectList.append(button);
  }
}

async function loadProject(project: TestingProject, restartTerminal = true): Promise<void> {
  currentProject = project;
  renderProjectList();
  renderRequirements(project);
  renderConversation();
  renderContextManager();
  await loadWorkspace({ root: project.workspaceRoot, name: project.name }, restartTerminal);
}

async function activateProject(projectId: string): Promise<void> {
  try {
    const project = await requireElectronApi().selectProject(projectId);
    await loadProject(project);
  } catch (error) {
    elements.workspaceStatus.textContent = error instanceof Error ? error.message : 'Unable to select project';
  }
}

async function createProject(): Promise<void> {
  const name = elements.projectName.value.trim();
  if (!name) return;
  try {
    const project = await requireElectronApi().createProject(name);
    if (!project) return;
    const state = await requireElectronApi().getProjectState();
    projects = state.projects;
    await loadProject(project);
    elements.projectDialog.close();
    elements.projectName.value = '';
  } catch (error) {
    elements.workspaceStatus.textContent = error instanceof Error ? error.message : 'Unable to create project';
  }
}

async function importRequirements(): Promise<void> {
  if (!currentProject) return;
  try {
    const updatedProject = await requireElectronApi().importProjectRequirements(currentProject.id);
    if (!updatedProject) return;
    projects = projects.map((project) => project.id === updatedProject.id ? updatedProject : project);
    currentProject = updatedProject;
    renderProjectList();
    renderRequirements(updatedProject);
    elements.workspaceStatus.textContent = `${updatedProject.name} · ${updatedProject.requirementsSourceName ?? 'requirements'}`;
  } catch (error) {
    elements.workspaceStatus.textContent = error instanceof Error ? error.message : 'Unable to import requirements';
  }
}

async function restoreProjects(): Promise<void> {
  try {
    const state = await requireElectronApi().getProjectState();
    projects = state.projects;
    const activeProject = projects.find((project) => project.id === state.activeProjectId) ?? projects[0];
    if (activeProject) await loadProject(activeProject);
    else {
      renderProjectList();
      renderRequirements(null);
      await startTerminal();
    }
  } catch (error) {
    elements.workspaceStatus.textContent = error instanceof Error ? error.message : 'Projects unavailable';
    renderProjectList();
    await startTerminal();
  }
}

function setWorkbenchTab(tab: 'requirements' | 'tools'): void {
  const showTools = tab === 'tools';
  elements.requirementsView.hidden = showTools;
  elements.toolsView.hidden = !showTools;
  elements.requirementsTab.classList.toggle('active', !showTools);
  elements.requirementsTab.setAttribute('aria-selected', String(!showTools));
  elements.toolsTab.classList.toggle('active', showTools);
  elements.toolsTab.setAttribute('aria-selected', String(showTools));
  elements.terminalToggle.classList.toggle('active', showTools);
  if (showTools) requestAnimationFrame(() => {
    fitTerminal();
    if (!terminalRunning && currentWorkspace) void startTerminal();
  });
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: ${id}`);
  return element as T;
}

async function getServerUrl(): Promise<string> {
  if (!window.electronAPI) {
    throw new Error('Electron API is unavailable');
  }
  return window.electronAPI.getServerUrl();
}

async function getApiHeaders(): Promise<Record<string, string>> {
  if (!window.electronAPI) throw new Error('Electron API is unavailable');
  return { 'X-CreativeMate-Token': await window.electronAPI.getApiToken() };
}

function getSelectedSkill(): SkillId {
  return elements.skill.value === 'document_creation' ? 'document_creation' : 'test_case_generation';
}

function getSubmitLabel(): string {
  return getSelectedSkill() === 'document_creation' ? 'Create document' : 'Generate test cases';
}

function appendInlineMarkdown(parent: HTMLElement, text: string): void {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));

    const token = match[0];
    const element = document.createElement(token.startsWith('**') ? 'strong' : token.startsWith('`') ? 'code' : 'em');
    element.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1);
    parent.append(element);
    cursor = index + token.length;
  }

  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function renderMarkdown(container: HTMLElement, markdown: string): void {
  const fragment = document.createDocumentFragment();
  let activeList: HTMLUListElement | HTMLOListElement | null = null;

  for (const sourceLine of markdown.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line) {
      activeList = null;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      activeList = null;
      const level = heading[1].length as 1 | 2 | 3;
      const element = document.createElement(`h${level}`);
      appendInlineMarkdown(element, heading[2]);
      fragment.append(element);
      continue;
    }

    const unorderedItem = /^[-*]\s+(.+)$/.exec(line);
    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(line);
    if (unorderedItem || orderedItem) {
      const listTag = unorderedItem ? 'UL' : 'OL';
      if (!activeList || activeList.tagName !== listTag) {
        activeList = document.createElement(unorderedItem ? 'ul' : 'ol');
        fragment.append(activeList);
      }
      const item = document.createElement('li');
      appendInlineMarkdown(item, (unorderedItem || orderedItem)?.[1] ?? '');
      activeList.append(item);
      continue;
    }

    activeList = null;
    if (/^_{3,}$|^-{3,}$/.test(line)) {
      fragment.append(document.createElement('hr'));
      continue;
    }

    const paragraph = document.createElement(line.startsWith('> ') ? 'blockquote' : 'p');
    appendInlineMarkdown(paragraph, line.startsWith('> ') ? line.slice(2) : line);
    fragment.append(paragraph);
  }

  container.replaceChildren(fragment);
}

function addMessage(role: MessageRole, content = ''): HTMLElement {
  const article = document.createElement('article');
  article.className = `message ${role}-message`;

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'You' : 'QA assistant';

  const body = document.createElement('div');
  body.className = 'message-content';
  if (role === 'assistant') renderMarkdown(body, content);
  else body.textContent = content;

  article.append(label, body);
  elements.messages.append(article);
  article.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return body;
}

function setBusy(busy: boolean): void {
  requestInProgress = busy;
  updateComposerControls();
  elements.prompt.disabled = busy;
  elements.send.textContent = busy ? 'Working…' : getSubmitLabel();
}

function updateComposerControls(): void {
  elements.send.disabled = requestInProgress || recordingInProgress || transcriptionInProgress;
  elements.microphone.disabled = requestInProgress || transcriptionInProgress;
  elements.clear.disabled = requestInProgress || recordingInProgress || transcriptionInProgress;
}

function parseSseBlock(block: string): StreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!data) return null;
  return JSON.parse(data) as StreamEvent;
}

async function consumeEventStream(response: Response, output: HTMLElement): Promise<string> {
  if (!response.body) throw new Error('The local service returned no response stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

  const handleBlock = (block: string): boolean => {
    if (!block.trim()) return false;

    const event = parseSseBlock(block);
    if (!event) return false;

    if (event.type === 'transcription' && event.content) {
      elements.recordingStatus.textContent = `Whisper transcription: ${event.content}`;
    } else if (event.type === 'chunk' && event.content) {
      fullResponse += event.content;
      renderMarkdown(output, fullResponse);
      output.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (event.type === 'error') {
      throw new Error(event.content || 'Local model request failed');
    }

    return event.type === 'complete';
  };

  let streamEnded = false;
  while (!streamEnded) {
    const { done, value } = await reader.read();
    streamEnded = done;
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (handleBlock(block)) return fullResponse;
    }

    if (streamEnded) {
      if (buffer.trim()) handleBlock(buffer);
      return fullResponse;
    }
  }
}

async function submitPrompt(): Promise<void> {
  const prompt = elements.prompt.value.trim();
  if (!prompt || requestInProgress || recordingInProgress || transcriptionInProgress) return;
  const skill = getSelectedSkill();
  const conversation = selectedConversationMemory()
    .filter((message) => message.enabled)
    .map(({ role, content }) => ({ role, content }));
  const contextItems = (currentProject?.contextItems ?? [])
    .filter((item) => item.enabled)
    .map(({ kind, title, content }) => ({ kind, title, content }));

  addMessage('user', prompt);
  const output = addMessage('assistant', skill === 'document_creation' ? 'Creating document…' : 'Generating lean test cases…');
  const payload = new FormData();
  payload.append('prompt', prompt);
  payload.append('messages', JSON.stringify(conversation));
  payload.append('contextItems', JSON.stringify(contextItems));
  payload.append('images', '[]');
  payload.append('skill', skill);

  setBusy(true);
  elements.prompt.value = '';

  try {
    const response = await fetch(`${await getServerUrl()}/prompt`, {
      method: 'POST',
      headers: await getApiHeaders(),
      body: payload,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Local service returned HTTP ${response.status}`);
    }

    output.textContent = '';
    const assistantResponse = await consumeEventStream(response, output);
    if (currentProject && assistantResponse.trim()) {
      const now = new Date().toISOString();
      currentProject.conversationMemory.push(
        { id: crypto.randomUUID(), skill, role: 'user', content: prompt, enabled: true, createdAt: now },
        { id: crypto.randomUUID(), skill, role: 'assistant', content: assistantResponse, enabled: true, createdAt: now },
      );
      try {
        await persistProjectAiState();
      } catch (error) {
        elements.workspaceStatus.textContent = error instanceof Error ? error.message : 'Unable to save conversation memory';
      }
    }
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : 'The local QA request failed';
    output.classList.add('error-text');
  } finally {
    setBusy(false);
    recordedAudio = null;
    elements.microphone.classList.remove('audio-ready');
    elements.microphone.textContent = '● Record with Whisper';
    elements.recordingStatus.textContent = '';
    elements.prompt.focus();
  }
}

async function transcribeRecording(audio: Blob): Promise<void> {
  transcriptionInProgress = true;
  recordedAudio = audio;
  updateComposerControls();
  elements.microphone.classList.add('audio-ready');
  elements.microphone.textContent = 'Transcribing locally…';
  elements.recordingStatus.textContent = 'Whisper is transcribing your recording locally.';

  try {
    const payload = new FormData();
    payload.append('audio', audio, 'requirement.webm');
    const response = await fetch(`${await getServerUrl()}/transcribe-audio`, {
      method: 'POST',
      headers: await getApiHeaders(),
      body: payload,
    });
    const result = (await response.json()) as { transcribedText?: string; error?: string };
    if (!response.ok) throw new Error(result.error || 'Whisper transcription failed');

    const transcript = result.transcribedText?.trim();
    if (!transcript) throw new Error('Whisper did not detect any speech. Please record again.');

    const existingPrompt = elements.prompt.value.trim();
    elements.prompt.value = existingPrompt ? `${existingPrompt}\n${transcript}` : transcript;
    recordedAudio = null;
    elements.recordingStatus.textContent = 'Review and correct the transcript above, then choose Generate tests.';
    elements.microphone.textContent = '● Record again';
    elements.prompt.focus();
    elements.prompt.setSelectionRange(elements.prompt.value.length, elements.prompt.value.length);
  } catch (error) {
    elements.recordingStatus.textContent = error instanceof Error ? error.message : 'Whisper transcription failed';
    elements.microphone.textContent = '↻ Retry transcription';
  } finally {
    transcriptionInProgress = false;
    updateComposerControls();
  }
}

async function toggleRecording(): Promise<void> {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  if (transcriptionInProgress || requestInProgress) return;
  if (recordedAudio) {
    void transcribeRecording(recordedAudio);
    return;
  }

  try {
    const permission = await window.electronAPI?.requestMicrophoneAccess();
    if (permission && !permission.microphone) throw new Error(permission.message);

    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(microphoneStream);
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) audioChunks.push(event.data);
    });
    mediaRecorder.addEventListener('stop', () => {
      const audio = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
      recordedAudio = audio;
      mediaRecorder = null;
      recordingInProgress = false;
      microphoneStream?.getTracks().forEach((track) => track.stop());
      microphoneStream = null;
      elements.microphone.setAttribute('aria-pressed', 'false');
      elements.microphone.classList.remove('recording');
      elements.microphone.classList.add('audio-ready');
      void transcribeRecording(audio);
    });
    mediaRecorder.start();
    recordingInProgress = true;
    updateComposerControls();
    elements.microphone.setAttribute('aria-pressed', 'true');
    elements.microphone.classList.add('recording');
    elements.microphone.classList.remove('audio-ready');
    elements.microphone.textContent = '■ Stop recording';
    elements.recordingStatus.textContent = 'Recording locally…';
  } catch (error) {
    recordingInProgress = false;
    updateComposerControls();
    elements.recordingStatus.textContent = error instanceof Error ? error.message : 'Microphone access failed';
  }
}

async function uploadDocument(): Promise<void> {
  if (!selectedDocument) return;
  elements.upload.disabled = true;
  elements.uploadStatus.textContent = 'Indexing locally…';

  try {
    const payload = new FormData();
    payload.append('document', selectedDocument);
    const response = await fetch(`${await getServerUrl()}/upload-document`, {
      method: 'POST',
      headers: await getApiHeaders(),
      body: payload,
    });
    const result = (await response.json()) as { message?: string; error?: string; details?: string };
    if (!response.ok) throw new Error(result.error || result.details || 'Document indexing failed');
    elements.uploadStatus.textContent = result.message || 'Document added to the local knowledge base.';
    selectedDocument = null;
    elements.documentInput.value = '';
  } catch (error) {
    elements.uploadStatus.textContent = error instanceof Error ? error.message : 'Document indexing failed';
  } finally {
    elements.upload.disabled = !selectedDocument;
  }
}

async function checkHealth(): Promise<void> {
  try {
    const response = await fetch(`${await getServerUrl()}/health`, { headers: await getApiHeaders() });
    if (!response.ok) throw new Error('Unavailable');
    elements.serviceStatus.innerHTML = '<span class="status-dot"></span> Local API ready';
  } catch {
    elements.serviceStatus.innerHTML = '<span class="status-dot unavailable"></span> Local API unavailable';
  }
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void submitPrompt();
});
elements.prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void submitPrompt();
  }
});
elements.skill.addEventListener('change', () => {
  const documentMode = getSelectedSkill() === 'document_creation';
  elements.prompt.placeholder = documentMode
    ? 'Describe the Markdown document you want to create.'
    : 'Example: A signed-in user can reset their password using a link that expires after 15 minutes.';
  elements.send.textContent = getSubmitLabel();
  renderConversation();
  renderContextManager();
});
elements.microphone.addEventListener('click', () => void toggleRecording());
elements.documentInput.addEventListener('change', () => {
  selectedDocument = elements.documentInput.files?.[0] ?? null;
  elements.upload.disabled = !selectedDocument;
  elements.uploadStatus.textContent = selectedDocument ? `${selectedDocument.name} selected` : '';
});
elements.upload.addEventListener('click', () => void uploadDocument());
elements.clear.addEventListener('click', () => void clearSelectedConversation());

function setContextManagerVisible(visible: boolean): void {
  elements.contextManager.hidden = !visible;
  elements.messages.hidden = visible;
  elements.form.hidden = visible;
  elements.contextToggle.setAttribute('aria-expanded', String(visible));
  elements.contextToggle.classList.toggle('active', visible);
  if (visible) renderContextManager();
}

elements.contextToggle.addEventListener('click', () => setContextManagerVisible(elements.contextManager.hidden));
elements.closeContext.addEventListener('click', () => setContextManagerVisible(false));
elements.addContext.addEventListener('click', () => openContextEditor('context'));
elements.clearMemory.addEventListener('click', () => void clearSelectedConversation());
elements.contextEditorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveContextEditor();
});
elements.cancelContextEditor.addEventListener('click', () => {
  elements.contextEditorDialog.close();
  contextEditorTarget = null;
});

elements.newProject.addEventListener('click', () => {
  elements.projectDialog.showModal();
  requestAnimationFrame(() => elements.projectName.focus());
});
elements.projectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void createProject();
});
elements.cancelProject.addEventListener('click', () => elements.projectDialog.close());
elements.workspaceTitle.addEventListener('click', () => elements.newProject.click());
elements.refreshWorkspace.addEventListener('click', () => void refreshWorkspace());
elements.importRequirements.addEventListener('click', () => void importRequirements());
elements.requirementsTab.addEventListener('click', () => setWorkbenchTab('requirements'));
elements.toolsTab.addEventListener('click', () => setWorkbenchTab('tools'));
elements.closePreview.addEventListener('click', () => elements.filePreviewPanel.classList.add('collapsed'));

elements.explorerToggle.addEventListener('click', () => {
  const collapsed = elements.ideBody.classList.toggle('explorer-collapsed');
  elements.explorerPanel.classList.toggle('collapsed', collapsed);
  elements.explorerToggle.classList.toggle('active', !collapsed);
  requestAnimationFrame(fitTerminal);
});
elements.assistantFocus.addEventListener('click', () => elements.prompt.focus());
elements.terminalToggle.addEventListener('click', () => setWorkbenchTab('tools'));
elements.restartTerminal.addEventListener('click', () => void startTerminal());

terminal.onData((data) => {
  if (terminalRunning) requireElectronApi().writeTerminal(data);
});

if (window.electronAPI) {
  window.electronAPI.onTerminalData((data) => terminal.write(data));
  window.electronAPI.onTerminalExit(({ exitCode, signal }) => {
    terminalRunning = false;
    terminal.writeln(`\r\n\x1b[38;5;245mProcess exited (${signal ? `signal ${signal}` : `code ${exitCode}`}).\x1b[0m`);
    elements.terminalStatus.textContent = `Terminal exited · ${exitCode}`;
  });
}

const terminalObserver = new ResizeObserver(() => fitTerminal());
terminalObserver.observe(elements.terminalContainer);

window.addEventListener('beforeunload', () => requireElectronApi().stopTerminal());

void checkHealth();
void restoreProjects();
