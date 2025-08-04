import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';

// Define absolute path to the Python script
const PYTHON_SCRIPT_PATH = path.join(process.cwd(), 'src', 'python', 'llmUtils.py');
const router = express.Router();


// Configure multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure multer for document uploads (larger file size limit)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for documents
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Root route
router.get('/', (req, res) => {
  res.json({ 
    message: 'LLM Chat API Server', 
    status: 'running',
    endpoints: {
      prompt: 'POST /api/prompt',
      health: 'GET /api/health'
    }
  });
});

// Endpoint to handle LLM prompts with streaming
router.post('/prompt', upload.single('audio'), (req, res) => {
  const promptInput = req.body.prompt || '';
  const images = req.body.images ? JSON.parse(req.body.images) : [];
  const messages = req.body.messages ? JSON.parse(req.body.messages) : [];
  const audioBuffer = req.file?.buffer;

  //For debugging purposes
  // console.log('Received prompt:', promptInput);
  // console.log('Received images:', images.length);
  // console.log('Received messages history:', messages.length);
  // console.log('Received audio size:', audioBuffer?.length);

  if (!promptInput && images.length === 0 && !audioBuffer) {
    return res.status(400).json({ error: 'Prompt, images, or audio are required' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Prepare the input for Python script
  const inputData = {
    prompt: promptInput,
    images: images,
    messages: messages,
    audioBuffer: audioBuffer ? audioBuffer.toString('base64') : null
  };

  const userInput = JSON.stringify(inputData);

  console.log('1: Sending to Python script:', inputData.images, promptInput);
  
  try {
    // Spawn Python process
    const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

  // Add these two lines immediately after the spawn call
  pythonProcess.stdin.write(userInput);
  pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: output } )}\n\n`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      res.write(`data: ${JSON.stringify({ type: 'complete', code })}\n\n`);
      res.end();
      pythonProcess.kill();
    });

    // Handle client disconnect
    // req.on('close', () => {
    //   pythonProcess.kill();
    // });

    // Handle process errors
    // pythonProcess.on('error', (error) => {
    //   console.error('Failed to start Python script:', error);
    //   res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
    //   res.end();
    // });

  } catch (error) {
    console.error('Error spawning Python process:', error);
    res.status(500).json({ error: 'Failed to process prompt' });
  }
});

// Endpoint to handle audio prompts with streaming
router.post('/prompt-audio', upload.single('audio'), (req, res) => {
  const promptInput = req.body.prompt || '';
  const images = req.body.images ? JSON.parse(req.body.images) : [];
  const messages = req.body.messages ? JSON.parse(req.body.messages) : [];
  const audioBuffer = req.file?.buffer;
  
  // console.log('Received audio prompt:', promptInput);
  // console.log('Received audio size:', audioBuffer?.length);
  // console.log('Received images:', images.length);
  // console.log('Received messages history:', messages.length);

  if (!promptInput && images.length === 0 && !audioBuffer) {
    return res.status(400).json({ error: 'Prompt, images, or audio are required' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Prepare the input for Python script
  const inputData = {
    prompt: promptInput,
    images: images,
    messages: messages,
    audio: audioBuffer ? audioBuffer.toString('base64') : null
  };
  
  const userInput = JSON.stringify(inputData).replace(/"/g, '\\"');

  console.log('Sending audio data to Python script', userInput);

  try {
    // Spawn Python process
    const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH, `'${userInput}'`], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: output } )}\n\n`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      res.write(`data: ${JSON.stringify({ type: 'complete', code })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      pythonProcess.kill();
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python script:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Error spawning Python process:', error);
    res.status(500).json({ error: 'Failed to process audio prompt' });
  }
});

// Endpoint to handle document uploads
router.post('/upload-document', documentUpload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const documentBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    console.log('Received PDF document:', originalName);
    console.log('Document size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');

    // Convert to base64 for RAG processing
    const documentBase64 = documentBuffer.toString('base64');
    console.log('Document converted to base64, length:', documentBase64.length);

    // Prepare input for RAG document ingestion
    const inputData = {
      document_to_ingest: {
        content: documentBase64,
        filename: originalName,
        size: fileSize
      }
    };

    const userInput = JSON.stringify(inputData);

    // Spawn Python process for RAG ingestion
    const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonProcess.stdin.write(userInput);
    pythonProcess.stdin.end();

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`RAG ingestion stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`RAG ingestion process exited with code ${code}`);
      
      if (code === 0) {
        res.json({
          success: true,
          message: 'Document processed and added to knowledge base successfully',
          filename: originalName,
          size: fileSize,
          output: output.trim()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to process document for RAG',
          details: errorOutput || output,
          filename: originalName
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start RAG ingestion process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start document processing',
        details: error.message
      });
    });


  } catch (error) {
    console.error('Error processing document upload:', error);
    res.status(500).json({ 
      error: 'Failed to process document upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// router.listen(PORT, () => {
//   console.log(`Server running on ${PORT}`);
// });

export const pythonRoutes = router;
