import { promises as fs } from 'node:fs';
import path from 'node:path';

export type WorkspaceEntryType = 'directory' | 'file' | 'symlink';

export interface WorkspaceEntry {
  name: string;
  relativePath: string;
  type: WorkspaceEntryType;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function normalizeWorkspaceRoot(candidate: string): Promise<string> {
  const root = await fs.realpath(candidate);
  const stats = await fs.stat(root);
  if (!stats.isDirectory()) throw new Error('The selected workspace is not a directory');
  return root;
}

export async function resolveWorkspacePath(root: string, relativePath = ''): Promise<string> {
  if (path.isAbsolute(relativePath)) throw new Error('Workspace paths must be relative');

  const normalizedRoot = await normalizeWorkspaceRoot(root);
  const requestedPath = path.resolve(normalizedRoot, relativePath);
  if (!isWithinRoot(normalizedRoot, requestedPath)) throw new Error('Path is outside the selected workspace');

  const resolvedPath = await fs.realpath(requestedPath);
  if (!isWithinRoot(normalizedRoot, resolvedPath)) throw new Error('Path is outside the selected workspace');
  return resolvedPath;
}

export async function listWorkspaceDirectory(root: string, relativePath = ''): Promise<WorkspaceEntry[]> {
  const directoryPath = await resolveWorkspacePath(root, relativePath);
  const stats = await fs.stat(directoryPath);
  if (!stats.isDirectory()) throw new Error('Workspace path is not a directory');

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .map((entry): WorkspaceEntry => ({
      name: entry.name,
      relativePath: path.join(relativePath, entry.name),
      type: entry.isSymbolicLink() ? 'symlink' : entry.isDirectory() ? 'directory' : 'file',
    }))
    .sort((left, right) => {
      if (left.type === 'directory' && right.type !== 'directory') return -1;
      if (left.type !== 'directory' && right.type === 'directory') return 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
}

export async function readWorkspaceFile(
  root: string,
  relativePath: string,
  maxBytes = 1024 * 1024,
): Promise<string> {
  const filePath = await resolveWorkspacePath(root, relativePath);
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) throw new Error('Workspace path is not a file');
  if (stats.size > maxBytes) throw new Error('File is too large to preview');

  const contents = await fs.readFile(filePath);
  if (contents.includes(0)) throw new Error('Binary files cannot be previewed');
  return contents.toString('utf8');
}

