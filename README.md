# CreativeMate - AI Creative Companion

A powerful desktop application that combines AI-powered creative assistance with offline speech-to-text capabilities and document knowledge integration. CreativeMate helps writers, artists, and creative professionals enhance their work through intelligent AI conversations and document-based insights.

## ✨ Features

- **🤖 AI Creative Assistant**: Chat with an AI specialized in creative arts, literature, and writing
- **📚 Document Knowledge Base (RAG)**: Upload PDF documents to enhance AI responses with your own knowledge
- **🎤 Offline Speech-to-Text**: Convert speech to text using OpenAI's Whisper model without internet connection
- **🌍 Multi-language Support**: Automatic language detection and response in the user's preferred language
- **💬 Conversation History**: Maintain context across chat sessions
- **🖼️ Image Support**: (NOT YET) Will include images when Ollama Gemma 3n supports it
- **📱 Cross-platform**: Available for Windows, macOS, and Linux

## 🛠️ Technologies Used

### Frontend & Desktop
- **Electron** - Cross-platform desktop application framework
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Express.js** - Backend API server
- **Node.js** - JavaScript runtime

### AI & Machine Learning Backend
- **Python 3** - AI processing backend
- **Ollama** - Local LLM inference
- **OpenAI Whisper** - Offline speech-to-text
- **LangChain** - RAG (Retrieval-Augmented Generation) framework
- **ChromaDB** - Vector database for document embeddings
- **PyPDF** - PDF document processing

## 📋 Prerequisites

Before setting up CreativeMate, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **Python 3.8+** (Tested using 3.11)
- **Ollama** - [Download and install Ollama](https://ollama.ai/)
- **FFmpeg** - Required for audio processing

### Platform-specific Requirements

#### macOS
```bash
brew install portaudio ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install portaudio19-dev python3-pyaudio ffmpeg python3-venv
```

#### Windows
- Download and install FFmpeg from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- Add FFmpeg to your system PATH

## 🚀 Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Create Python virtual environment
python3 -m venv venv_creativemate

# Activate virtual environment
# On macOS/Linux:
source venv_creativemate/bin/activate
# On Windows:
venv_creativemate\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Setup Ollama Model

```bash
# Pull the required model (this may take a few minutes)
ollama pull gemma3n:e4b

# Verify the model is available
ollama list
```

### 3. Verify Whisper Installation

```bash
# Test Whisper installation
python3 src/python/whisper_stt.py --list-models
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start the Electron application in development mode
npm start
```

This will:
- Launch the Electron application
- Start the internal Express server
- Open developer tools for debugging

### Building for Production

```bash
# Package the application for your current platform
npm run package

# Create distributable installers
npm run make
```

## 📖 Usage Guide

### Basic Chat
1. Launch CreativeMate
2. Type your creative prompt in the chat interface OR Use the microphone. Remember to stopthe microphone so that the back-end will transcribe the speech.
3. Receive AI-powered responses tailored for creative work

### Document Upload (RAG)
1. Go to Settings. Click the document upload button
2. Select a PDF file to add to your knowledge base
3. The AI will use information from uploaded documents to enhance responses

### Voice Input
1. Click the microphone button
2. Speak your prompt clearly
3. The speech will be transcribed offline using Whisper. Check the text and click Send.
4. The AI will respond to your spoken input

### Supported Languages
- Check Settings for supported languages for localisation.
- When using the microphone, speak using different languages.

### Supported File Types
- **Documents**: PDF files for knowledge base integration
- **Audio**: WAV, MP3, M4A, FLAC, OGG, AAC, WMA for speech-to-text

## 🔧 Configuration

### Python Virtual Environment
The application expects a Python virtual environment at `venv_creativemate/` with all required dependencies installed.

### Ollama Model
The default model is `gemma3n:e4b`. You can modify this in `src/python/llmUtils.py` if needed.

### Whisper Model
The default Whisper model is `base`. You can change this in the Python configuration for different speed/accuracy trade-offs:
- `tiny`: Fastest, lowest accuracy (~39 MB)
- `base`: Good balance (~74 MB) - **Default**
- `small`: Better accuracy (~244 MB)
- `medium`: High accuracy (~769 MB)
- `large`: Highest accuracy (~1550 MB)

## 📁 Project Structure

```
creativemate-app/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Electron preload script
│   ├── renderer.ts          # Electron renderer process
│   ├── server/
│   │   └── server.ts        # Express server setup
│   ├── routes/
│   │   └── pythonRoutes.ts  # API routes for Python integration
│   └── python/
│       ├── llmUtils.py      # Main LLM and RAG processing
│       ├── whisper_integration.py  # Whisper STT integration
│       └── whisper_stt.py   # Standalone Whisper implementation
├── requirements.txt         # Python dependencies
├── package.json            # Node.js dependencies and scripts
└── forge.config.ts         # Electron Forge configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
- Follow TypeScript best practices
- Maintain clean separation between Electron and Python components
- Test both online and offline functionality
- Ensure cross-platform compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Python dependencies not found**
- Ensure the virtual environment is activated and dependencies are installed
- Check that the Python executable path is correct in the configuration

**Ollama model not available**
- Run `ollama pull gemma3n:e4b` to download the required model
- Verify Ollama is running with `ollama list`

**Audio recording not working**
- Check microphone permissions in your operating system
- Ensure PyAudio is properly installed for your platform
- Verify FFmpeg is installed and accessible

**Document upload fails**
- Ensure the PDF file is not corrupted
- Check that the file size is under 20MB
- Verify Python RAG dependencies are installed

## 🔗 Useful Links

- [Electron Documentation](https://www.electronjs.org/docs)
- [Ollama Documentation](https://ollama.ai/docs)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [LangChain Documentation](https://python.langchain.com/)

---

**Author**: Christine Abarca  
**Email**: christineabarca0820@gmail.com