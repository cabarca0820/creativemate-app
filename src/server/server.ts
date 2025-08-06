import express from 'express';
import http from 'http';
import cors from 'cors';
import { pythonRoutes } from '../routes/pythonRoutes.ts';


export class ElectronServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port = 0;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    // this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' })); // Increase body size limit for large conversations
    this.app.use(express.json());
    this.app.use('/', pythonRoutes);
  }

  // private setupRoutes(): void {
  //   this.app.get('/api/health', (req, res) => {
  //     res.json({ status: 'ok', timestamp: new Date().toISOString() });
  //   });

  //   this.app.get('/api/prompt', (req, res) => {
  //     res.json({ 
  //       message: 'Hello from Electron server!',
  //       data: [1, 2, 3, 4, 5]
  //     });
  //   });

  //   // Add more routes as needed
  //   this.app.post('/api/data', (req, res) => {
  //     console.log('Received data:', req.body);
  //     res.json({ success: true, received: req.body });
  //   });
  // }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(0, 'localhost', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          console.log(`Electron server started on http://localhost:${this.port}`);
          resolve(this.port);
        } else {
          reject(new Error('Failed to start server'));
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Electron server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }
}
