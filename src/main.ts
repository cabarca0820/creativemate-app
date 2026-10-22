import { app, BrowserWindow, dialog, ipcMain, session, systemPreferences } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import type { IPty } from 'node-pty';
import started from 'electron-squirrel-startup';
import { ElectronServer } from './server/server';
import { listWorkspaceDirectory, normalizeWorkspaceRoot, readWorkspaceFile } from './workspace/workspaceService';
import {
  createTestingProject,
  normalizeProjectName,
  parseContextItems,
  parseConversationMemory,
  parseProjectState,
  type ProjectState,
  type TestingProject,
} from './projects/projectService';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) app.quit();

const apiToken = crypto.randomBytes(32).toString('hex');
let electronServer: ElectronServer | undefined;
let serverPort: number | undefined;
let workspaceRoot: string | undefined;
let projectState: ProjectState = { projects: [] };
const terminalSessions = new Map<number, IPty>();
const MAX_REQUIREMENTS_BYTES = 1_048_576;

interface TerminalSize {
  cols?: number;
  rows?: number;
}

function getWorkspaceStatePath(): string {
  return path.join(app.getPath('userData'), 'workspace-state.json');
}

function getProjectStatePath(): string {
  return path.join(app.getPath('userData'), 'projects-state.json');
}

function getActiveProject(): TestingProject | undefined {
  return projectState.projects.find((project) => project.id === projectState.activeProjectId);
}

function getWorkspaceInfo(): { root: string; name: string } | null {
  if (!workspaceRoot) return null;
  return { root: workspaceRoot, name: path.basename(workspaceRoot) };
}

async function persistProjects(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true });
  const statePath = getProjectStatePath();
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(projectState, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, statePath);
}

async function restoreWorkspace(): Promise<void> {
  try {
    projectState = parseProjectState(JSON.parse(await readFile(getProjectStatePath(), 'utf8')));
    const activeProject = getActiveProject();
    if (activeProject) {
      workspaceRoot = await normalizeWorkspaceRoot(activeProject.workspaceRoot);
      return;
    }
  } catch {
    projectState = { projects: [] };
  }

  try {
    const legacyState = JSON.parse(await readFile(getWorkspaceStatePath(), 'utf8')) as { root?: unknown };
    if (typeof legacyState.root !== 'string') return;
    const root = await normalizeWorkspaceRoot(legacyState.root);
    const project = createTestingProject(crypto.randomUUID(), path.basename(root), root);
    projectState = { projects: [project], activeProjectId: project.id };
    workspaceRoot = root;
    await persistProjects();
  } catch {
    workspaceRoot = undefined;
  }
}

async function selectProject(projectId: unknown, senderId: number): Promise<TestingProject> {
  if (typeof projectId !== 'string') throw new Error('Project id must be text');
  const project = projectState.projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new Error('Project was not found');
  workspaceRoot = await normalizeWorkspaceRoot(project.workspaceRoot);
  projectState.activeProjectId = project.id;
  await persistProjects();
  stopTerminal(senderId);
  return project;
}

async function createProjectForFolder(name: unknown, folder: string, senderId: number): Promise<TestingProject> {
  const projectName = normalizeProjectName(name);
  const normalizedRoot = await normalizeWorkspaceRoot(folder);
  const existing = projectState.projects.find((project) => project.workspaceRoot === normalizedRoot);
  if (existing) return selectProject(existing.id, senderId);

  const project = createTestingProject(crypto.randomUUID(), projectName, normalizedRoot);
  projectState.projects.push(project);
  projectState.activeProjectId = project.id;
  workspaceRoot = normalizedRoot;
  await persistProjects();
  stopTerminal(senderId);
  return project;
}

function boundedTerminalSize(size: TerminalSize): { cols: number; rows: number } {
  const cols = Number.isFinite(size.cols) ? Math.trunc(size.cols ?? 80) : 80;
  const rows = Number.isFinite(size.rows) ? Math.trunc(size.rows ?? 24) : 24;
  return {
    cols: Math.min(500, Math.max(20, cols)),
    rows: Math.min(200, Math.max(5, rows)),
  };
}

function terminalEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' })
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function loadPty(): typeof import('node-pty') {
  // Keep the native module off the application startup path. Forge rebuilds it
  // for Electron, and it is loaded only when a terminal is actually requested.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(app.isPackaged ? path.join(process.resourcesPath, 'node-pty') : 'node-pty') as typeof import('node-pty');
}

function stopTerminal(webContentsId: number): void {
  const terminal = terminalSessions.get(webContentsId);
  if (!terminal) return;
  terminalSessions.delete(webContentsId);
  try {
    terminal.kill();
  } catch (error) {
    console.error('Failed to stop terminal:', error);
  }
}

function registerWorkspaceHandlers(): void {
  ipcMain.handle('projects:get-state', () => projectState);
  ipcMain.handle('projects:create', async (event, name: unknown) => {
    const projectName = normalizeProjectName(name);
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(owner, {
      title: `Choose the application folder for ${projectName}`,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return createProjectForFolder(projectName, result.filePaths[0], event.sender.id);
  });
  ipcMain.handle('projects:select', (event, projectId: unknown) => selectProject(projectId, event.sender.id));
  ipcMain.handle('projects:update-ai-state', async (_event, projectId: unknown, state: unknown) => {
    if (typeof projectId !== 'string') throw new Error('Project id must be text');
    const project = projectState.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('Project was not found');
    if (!state || typeof state !== 'object') throw new Error('AI context state is invalid');
    const candidate = state as { contextItems?: unknown; conversationMemory?: unknown };
    project.contextItems = parseContextItems(candidate.contextItems);
    project.conversationMemory = parseConversationMemory(candidate.conversationMemory);
    project.updatedAt = new Date().toISOString();
    await persistProjects();
    return project;
  });
  ipcMain.handle('projects:import-requirements', async (event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('Project id must be text');
    const project = projectState.projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error('Project was not found');

    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(owner, {
      title: `Import requirements for ${project.name}`,
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    const fileStats = await stat(filePath);
    if (!fileStats.isFile() || fileStats.size > MAX_REQUIREMENTS_BYTES) {
      throw new Error('Requirements must be a Markdown file no larger than 1 MB');
    }
    const markdown = await readFile(filePath, 'utf8');
    if (markdown.includes('\0')) throw new Error('Requirements must be a text Markdown file');
    project.requirementsMarkdown = markdown;
    project.requirementsSourceName = path.basename(filePath);
    project.updatedAt = new Date().toISOString();
    await persistProjects();
    return project;
  });
  ipcMain.handle('workspace:get', () => getWorkspaceInfo());
  ipcMain.handle('workspace:choose', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(owner, {
      title: 'Open testing workspace',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return getWorkspaceInfo();

    const project = await createProjectForFolder(path.basename(result.filePaths[0]), result.filePaths[0], event.sender.id);
    return { root: project.workspaceRoot, name: project.name };
  });
  ipcMain.handle('workspace:list', async (_event, relativePath: unknown) => {
    if (!workspaceRoot) throw new Error('Choose a workspace folder first');
    if (typeof relativePath !== 'string') throw new Error('Workspace path must be text');
    return listWorkspaceDirectory(workspaceRoot, relativePath);
  });
  ipcMain.handle('workspace:read', async (_event, relativePath: unknown) => {
    if (!workspaceRoot) throw new Error('Choose a workspace folder first');
    if (typeof relativePath !== 'string') throw new Error('Workspace path must be text');
    return readWorkspaceFile(workspaceRoot, relativePath);
  });

  ipcMain.handle('terminal:start', (event, requestedSize: TerminalSize = {}) => {
    if (!workspaceRoot) throw new Error('Choose a workspace folder before starting the terminal');
    stopTerminal(event.sender.id);

    const shell = process.platform === 'win32'
      ? (process.env.COMSPEC || 'powershell.exe')
      : (process.env.SHELL || '/bin/zsh');
    const args = process.platform === 'win32' ? [] : ['-l'];
    const size = boundedTerminalSize(requestedSize);
    const terminal = loadPty().spawn(shell, args, {
      name: 'xterm-256color',
      cols: size.cols,
      rows: size.rows,
      cwd: workspaceRoot,
      env: terminalEnvironment(),
    });

    terminalSessions.set(event.sender.id, terminal);
    terminal.onData((data) => {
      if (!event.sender.isDestroyed()) event.sender.send('terminal:data', data);
    });
    terminal.onExit(({ exitCode, signal }) => {
      terminalSessions.delete(event.sender.id);
      if (!event.sender.isDestroyed()) event.sender.send('terminal:exit', { exitCode, signal });
    });
    event.sender.once('destroyed', () => stopTerminal(event.sender.id));
    return { pid: terminal.pid, shell };
  });
  ipcMain.on('terminal:write', (event, data: unknown) => {
    if (typeof data !== 'string' || data.length > 65_536) return;
    terminalSessions.get(event.sender.id)?.write(data);
  });
  ipcMain.on('terminal:resize', (event, requestedSize: TerminalSize) => {
    const terminal = terminalSessions.get(event.sender.id);
    if (!terminal) return;
    const size = boundedTerminalSize(requestedSize ?? {});
    terminal.resize(size.cols, size.rows);
  });
  ipcMain.on('terminal:stop', (event) => stopTerminal(event.sender.id));
}

function getPythonConfiguration() {
  const resourceRoot = app.isPackaged ? process.resourcesPath : process.cwd();
  const virtualEnvironment = path.join(resourceRoot, 'venv_creativemate');
  return {
    pythonExecutable: process.platform === 'win32'
      ? path.join(virtualEnvironment, 'Scripts', 'python.exe')
      : path.join(virtualEnvironment, 'bin', 'python3'),
    pythonScriptPath: app.isPackaged
      ? path.join(resourceRoot, 'python', 'llmUtils.py')
      : path.join(resourceRoot, 'src', 'python', 'llmUtils.py'),
    dataDirectory: path.join(app.getPath('userData'), 'data'),
  };
}

async function ensureServer(): Promise<number> {
  if (serverPort) return serverPort;
  electronServer = new ElectronServer({ ...getPythonConfiguration(), apiToken });
  serverPort = await electronServer.start();
  return serverPort;
}

async function createWindow(): Promise<void> {
  try {
    await ensureServer();
  } catch (error) {
    console.error('Failed to start the local API:', error);
    app.quit();
    return;
  }

  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 760,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

ipcMain.handle('get-server-port', () => serverPort);
ipcMain.handle('get-server-url', () => {
  if (!serverPort) throw new Error('Local API is not ready');
  return `http://127.0.0.1:${serverPort}`;
});
ipcMain.handle('get-api-token', () => apiToken);
ipcMain.handle('request-microphone-access', async () => {
  try {
    const microphone = process.platform === 'darwin'
      ? await systemPreferences.askForMediaAccess('microphone')
      : true;
    return {
      success: microphone,
      microphone,
      message: microphone ? 'Microphone access granted' : 'Microphone access denied',
    };
  } catch (error) {
    return {
      success: false,
      microphone: false,
      message: error instanceof Error ? error.message : 'Microphone permission failed',
    };
  }
});

app.whenReady().then(async () => {
  await restoreWorkspace();
  registerWorkspaceHandlers();
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('before-quit', () => {
  for (const webContentsId of terminalSessions.keys()) stopTerminal(webContentsId);
  if (electronServer) void electronServer.stop();
});
