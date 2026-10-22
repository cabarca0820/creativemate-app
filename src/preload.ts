// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  getApiToken: () => ipcRenderer.invoke('get-api-token'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('request-microphone-access'),
  getProjectState: () => ipcRenderer.invoke('projects:get-state'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  selectProject: (projectId: string) => ipcRenderer.invoke('projects:select', projectId),
  updateProjectAiState: (projectId: string, state: ProjectAiState) => ipcRenderer.invoke('projects:update-ai-state', projectId, state),
  importProjectRequirements: (projectId: string) => ipcRenderer.invoke('projects:import-requirements', projectId),
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  listWorkspaceDirectory: (relativePath: string) => ipcRenderer.invoke('workspace:list', relativePath),
  readWorkspaceFile: (relativePath: string) => ipcRenderer.invoke('workspace:read', relativePath),
  startTerminal: (size: { cols: number; rows: number }) => ipcRenderer.invoke('terminal:start', size),
  writeTerminal: (data: string) => ipcRenderer.send('terminal:write', data),
  resizeTerminal: (size: { cols: number; rows: number }) => ipcRenderer.send('terminal:resize', size),
  stopTerminal: () => ipcRenderer.send('terminal:stop'),
  onTerminalData: (callback: (data: string) => void) => subscribe('terminal:data', callback),
  onTerminalExit: (callback: (result: TerminalExit) => void) => subscribe('terminal:exit', callback),
});
