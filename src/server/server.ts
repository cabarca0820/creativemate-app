import express, { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import cors from 'cors';
import { createPythonRoutes, PythonRouteOptions } from '../routes/pythonRoutes';

interface ElectronServerOptions extends PythonRouteOptions {
  apiToken: string;
}

export class ElectronServer {
  private readonly app: express.Application;
  private readonly options: ElectronServerOptions;
  private server: http.Server | null = null;
  private port = 0;

  constructor(options: ElectronServerOptions) {
    this.options = options;
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.disable('x-powered-by');
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowed = !origin
          || origin === 'null'
          || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
        callback(allowed ? null : new Error('Origin is not allowed'), allowed);
      },
      allowedHeaders: ['Content-Type', 'X-CreativeMate-Token'],
    }));
    this.app.use((request, response, next) => this.authenticate(request, response, next));
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use('/', createPythonRoutes(this.options));
    this.app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
      void _next;
      const message = error instanceof Error ? error.message : 'Invalid request';
      const status = message.includes('File too large') ? 413 : 400;
      response.status(status).json({ error: message });
    });
  }

  private authenticate(request: Request, response: Response, next: NextFunction): void {
    if (request.header('x-creativemate-token') !== this.options.apiToken) {
      response.status(401).json({ error: 'Local API authentication failed' });
      return;
    }
    next();
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          console.log(`Local API started on 127.0.0.1:${this.port}`);
          resolve(this.port);
        } else {
          reject(new Error('Failed to determine the local API port'));
        }
      });
      this.server.once('error', reject);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
