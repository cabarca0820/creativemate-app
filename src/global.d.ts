declare namespace NodeJS {
  interface Process {
    resourcesPath: string;
  }
}

interface MicrophonePermissionResult {
  success: boolean;
  microphone: boolean;
  message: string;
}

interface WorkspaceInfo {
  root: string;
  name: string;
}

interface TestingProject {
  id: string;
  name: string;
  workspaceRoot: string;
  requirementsMarkdown: string;
  requirementsSourceName?: string;
  contextItems: ProjectContextItem[];
  conversationMemory: ProjectConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

type ProjectContextKind = 'requirement' | 'memory';
type ProjectSkillId = 'test_case_generation' | 'document_creation';

interface ProjectContextItem {
  id: string;
  kind: ProjectContextKind;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProjectConversationMessage {
  id: string;
  skill: ProjectSkillId;
  role: 'user' | 'assistant';
  content: string;
  enabled: boolean;
  createdAt: string;
}

interface ProjectAiState {
  contextItems: ProjectContextItem[];
  conversationMemory: ProjectConversationMessage[];
}

interface ProjectState {
  projects: TestingProject[];
  activeProjectId?: string;
}

type WorkspaceEntryType = 'directory' | 'file' | 'symlink';

interface WorkspaceEntry {
  name: string;
  relativePath: string;
  type: WorkspaceEntryType;
}

interface TerminalSize {
  cols: number;
  rows: number;
}

interface TerminalExit {
  exitCode: number;
  signal?: number;
}

interface ElectronAPI {
  getServerPort(): Promise<number>;
  getServerUrl(): Promise<string>;
  getApiToken(): Promise<string>;
  requestMicrophoneAccess(): Promise<MicrophonePermissionResult>;
  getProjectState(): Promise<ProjectState>;
  createProject(name: string): Promise<TestingProject | null>;
  selectProject(projectId: string): Promise<TestingProject>;
  updateProjectAiState(projectId: string, state: ProjectAiState): Promise<TestingProject>;
  importProjectRequirements(projectId: string): Promise<TestingProject | null>;
  getWorkspace(): Promise<WorkspaceInfo | null>;
  chooseWorkspace(): Promise<WorkspaceInfo | null>;
  listWorkspaceDirectory(relativePath: string): Promise<WorkspaceEntry[]>;
  readWorkspaceFile(relativePath: string): Promise<string>;
  startTerminal(size: TerminalSize): Promise<{ pid: number; shell: string }>;
  writeTerminal(data: string): void;
  resizeTerminal(size: TerminalSize): void;
  stopTerminal(): void;
  onTerminalData(callback: (data: string) => void): () => void;
  onTerminalExit(callback: (result: TerminalExit) => void): () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
