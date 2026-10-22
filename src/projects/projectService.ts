import path from 'node:path';

export interface TestingProject {
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

export type ProjectContextKind = 'requirement' | 'memory';
export type ProjectSkillId = 'test_case_generation' | 'document_creation';

export interface ProjectContextItem {
  id: string;
  kind: ProjectContextKind;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectConversationMessage {
  id: string;
  skill: ProjectSkillId;
  role: 'user' | 'assistant';
  content: string;
  enabled: boolean;
  createdAt: string;
}

export interface ProjectState {
  projects: TestingProject[];
  activeProjectId?: string;
}

export function normalizeProjectName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Project name must be text');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Enter a project name');
  if (name.length > 80) throw new Error('Project name must be 80 characters or fewer');
  return name;
}

export function createTestingProject(
  id: string,
  name: unknown,
  workspaceRoot: string,
  now = new Date().toISOString(),
): TestingProject {
  return {
    id,
    name: normalizeProjectName(name),
    workspaceRoot,
    requirementsMarkdown: '',
    contextItems: [],
    conversationMemory: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function parseProjectState(value: unknown): ProjectState {
  if (!value || typeof value !== 'object') return { projects: [] };
  const candidate = value as { projects?: unknown; activeProjectId?: unknown };
  if (!Array.isArray(candidate.projects)) return { projects: [] };

  const projects = candidate.projects.flatMap((item): TestingProject[] => {
    if (!item || typeof item !== 'object') return [];
    const project = item as Partial<TestingProject>;
    const valid = typeof project.id === 'string'
      && typeof project.name === 'string'
      && typeof project.workspaceRoot === 'string'
      && path.isAbsolute(project.workspaceRoot)
      && typeof project.requirementsMarkdown === 'string'
      && typeof project.createdAt === 'string'
      && typeof project.updatedAt === 'string'
      && (project.requirementsSourceName === undefined || typeof project.requirementsSourceName === 'string');
    if (!valid) return [];
    return [{
      ...project as TestingProject,
      contextItems: parseContextItems(project.contextItems),
      conversationMemory: parseConversationMemory(project.conversationMemory),
    }];
  });

  const requestedActiveId = typeof candidate.activeProjectId === 'string' ? candidate.activeProjectId : undefined;
  const activeProjectId = projects.some((project) => project.id === requestedActiveId)
    ? requestedActiveId
    : projects[0]?.id;
  return { projects, activeProjectId };
}

export function parseContextItems(value: unknown): ProjectContextItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((item): ProjectContextItem[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<ProjectContextItem>;
    if (typeof candidate.id !== 'string'
      || (candidate.kind !== 'requirement' && candidate.kind !== 'memory')
      || typeof candidate.title !== 'string'
      || typeof candidate.content !== 'string'
      || typeof candidate.enabled !== 'boolean'
      || typeof candidate.createdAt !== 'string'
      || typeof candidate.updatedAt !== 'string') return [];
    const title = candidate.title.trim().slice(0, 120);
    const content = candidate.content.trim().slice(0, 20_000);
    if (!title || !content) return [];
    return [{ ...candidate as ProjectContextItem, title, content }];
  });
}

export function parseConversationMemory(value: unknown): ProjectConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-60).flatMap((item): ProjectConversationMessage[] => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<ProjectConversationMessage>;
    if (typeof candidate.id !== 'string'
      || (candidate.skill !== 'test_case_generation' && candidate.skill !== 'document_creation')
      || (candidate.role !== 'user' && candidate.role !== 'assistant')
      || typeof candidate.content !== 'string'
      || typeof candidate.enabled !== 'boolean'
      || typeof candidate.createdAt !== 'string') return [];
    const content = candidate.content.trim().slice(0, 50_000);
    if (!content) return [];
    return [{ ...candidate as ProjectConversationMessage, content }];
  });
}
