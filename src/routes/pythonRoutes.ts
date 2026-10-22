import express, { Request, Response } from 'express';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import multer from 'multer';

export interface PythonRouteOptions {
  pythonExecutable: string;
  pythonScriptPath: string;
  dataDirectory: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FocusedContextItem {
  kind: 'requirement' | 'memory';
  title: string;
  content: string;
}

const MAX_PROMPT_LENGTH = 50_000;
const PROCESS_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SKILL = 'test_case_generation';
const SUPPORTED_SKILLS = new Set([DEFAULT_SKILL, 'document_creation']);

const promptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

function parseJsonArray(value: unknown, fieldName: string): unknown[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') throw new Error(`${fieldName} must be JSON`);
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`${fieldName} must be an array`);
  return parsed;
}

function parseMessages(value: unknown): ConversationMessage[] {
  return parseJsonArray(value, 'messages').map((message) => {
    if (!message || typeof message !== 'object') throw new Error('Each message must be an object');
    const candidate = message as Record<string, unknown>;
    if ((candidate.role !== 'user' && candidate.role !== 'assistant') || typeof candidate.content !== 'string') {
      throw new Error('Each message requires a valid role and text content');
    }
    return {
      role: candidate.role as ConversationMessage['role'],
      content: candidate.content.slice(0, MAX_PROMPT_LENGTH),
    };
  }).slice(-30);
}

function parseContextItems(value: unknown): FocusedContextItem[] {
  return parseJsonArray(value, 'contextItems').slice(0, 30).map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Each context item must be an object');
    const candidate = item as Record<string, unknown>;
    if ((candidate.kind !== 'requirement' && candidate.kind !== 'memory')
      || typeof candidate.title !== 'string'
      || typeof candidate.content !== 'string') {
      throw new Error('Each context item requires a valid kind, title, and content');
    }
    const title = candidate.title.trim().slice(0, 120);
    const content = candidate.content.trim().slice(0, 20_000);
    if (!title || !content) throw new Error('Context title and content cannot be empty');
    return { kind: candidate.kind, title, content };
  });
}

function spawnPython(options: PythonRouteOptions, input: unknown): ChildProcessWithoutNullStreams {
  const child = spawn(options.pythonExecutable, [options.pythonScriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CREATIVEMATE_DATA_DIR: options.dataDirectory,
      PYTHONUNBUFFERED: '1',
    },
  });
  child.stdin.end(JSON.stringify(input));
  return child;
}

function sendSse(response: Response, event: Record<string, unknown>): void {
  if (!response.writableEnded) response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function streamPython(options: PythonRouteOptions, input: unknown, response: Response): void {
  response.status(200);
  response.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();

  let child: ChildProcessWithoutNullStreams;
  let settled = false;

  try {
    child = spawnPython(options, input);
  } catch (error) {
    sendSse(response, { type: 'error', content: error instanceof Error ? error.message : 'Python failed to start' });
    response.end();
    return;
  }

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      sendSse(response, { type: 'error', content: 'Local model request timed out' });
      child.kill();
      response.end();
    }
  }, PROCESS_TIMEOUT_MS);

  child.stdout.on('data', (data: Buffer) => response.write(data));
  child.stderr.on('data', (data: Buffer) => console.error(`[python] ${data.toString().trimEnd()}`));
  child.once('error', (error) => {
    settled = true;
    clearTimeout(timeout);
    sendSse(response, { type: 'error', content: `Unable to start the local AI service: ${error.message}` });
    response.end();
  });
  child.once('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (code === 0) sendSse(response, { type: 'complete', code: 0 });
    else sendSse(response, { type: 'error', content: 'The local AI process stopped unexpectedly' });
    response.end();
  });
  response.once('close', () => {
    if (!settled) child.kill();
  });
}

function collectPython(
  options: PythonRouteOptions,
  input: unknown,
  response: Response,
  outputField = 'output',
): void {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawnPython(options, input);
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Python failed to start' });
    return;
  }

  let output = '';
  let diagnostics = '';
  let responded = false;
  const timeout = setTimeout(() => child.kill(), PROCESS_TIMEOUT_MS);

  child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
  child.stderr.on('data', (data: Buffer) => { diagnostics += data.toString(); });
  child.once('error', (error) => {
    responded = true;
    clearTimeout(timeout);
    response.status(500).json({ error: `Unable to start the local AI service: ${error.message}` });
  });
  child.once('close', (code) => {
    clearTimeout(timeout);
    if (responded) return;
    if (code === 0) response.json({ success: true, [outputField]: output.trim() });
    else response.status(500).json({ error: output.trim() || diagnostics.trim() || 'Local processing failed' });
  });
  response.once('close', () => {
    if (!child.killed) child.kill();
  });
}

export function createPythonRoutes(options: PythonRouteOptions): express.Router {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.json({ message: 'CreativeMate local QA API', status: 'running' });
  });

  router.get('/health', (_request, response) => {
    response.json({ status: 'OK', mode: 'local-only', timestamp: new Date().toISOString() });
  });

  router.post('/prompt', promptUpload.single('audio'), (request: Request, response: Response) => {
    try {
      const prompt = typeof request.body.prompt === 'string' ? request.body.prompt.trim() : '';
      if (prompt.length > MAX_PROMPT_LENGTH) {
        response.status(413).json({ error: 'Prompt is too long' });
        return;
      }

      const messages = parseMessages(request.body.messages);
      const contextItems = parseContextItems(request.body.contextItems);
      const images = parseJsonArray(request.body.images, 'images');
      const skill = typeof request.body.skill === 'string' ? request.body.skill : DEFAULT_SKILL;
      if (!SUPPORTED_SKILLS.has(skill)) {
        response.status(400).json({ error: 'Unsupported skill' });
        return;
      }
      if (!prompt && !request.file) {
        response.status(400).json({ error: 'A requirement or voice recording is required' });
        return;
      }

      streamPython(options, {
        prompt,
        messages,
        contextItems,
        images,
        skill,
        audioBuffer: request.file?.buffer.toString('base64') ?? null,
      }, response);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid prompt request' });
    }
  });

  router.post('/transcribe-audio', audioUpload.single('audio'), (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: 'No audio file provided' });
      return;
    }
    collectPython(
      options,
      { audio_to_transcribe: request.file.buffer.toString('base64') },
      response,
      'transcribedText',
    );
  });

  router.post('/upload-document', documentUpload.single('document'), (request, response) => {
    if (!request.file) {
      response.status(400).json({ error: 'A valid PDF document is required' });
      return;
    }

    const originalName = request.file.originalname.replace(/[\r\n]/g, '').slice(0, 255);
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawnPython(options, {
        document_to_ingest: {
          content: request.file.buffer.toString('base64'),
          filename: originalName,
          size: request.file.size,
          mimeType: request.file.mimetype,
        },
      });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Document processing failed' });
      return;
    }

    let output = '';
    let diagnostics = '';
    let responded = false;
    const timeout = setTimeout(() => child.kill(), PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { diagnostics += data.toString(); });
    child.once('error', (error) => {
      responded = true;
      clearTimeout(timeout);
      response.status(500).json({ error: `Unable to start document processing: ${error.message}` });
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (responded) return;
      if (code === 0) {
        response.json({ success: true, message: output.trim(), filename: originalName, size: request.file?.size });
      } else {
        response.status(500).json({ error: output.trim() || diagnostics.trim() || 'Document indexing failed' });
      }
    });
    response.once('close', () => {
      if (!child.killed) child.kill();
    });
  });

  return router;
}
