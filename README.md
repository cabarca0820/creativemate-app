# CreativeMate QA

CreativeMate QA is a local-first Electron workbench that turns requirements, user stories, and specifications into reviewable software test scenarios. Ollama performs inference locally, Whisper transcribes microphone recordings locally, and uploaded PDF context is stored in a local Chroma database.

The application has no hosted-AI fallback. After the required models and dependencies are installed, normal QA work does not consume hosted AI tokens or send prompts to a model provider.

## Current workflow

1. Choose lean Given–When–Then test cases or concise Markdown document creation.
2. Enter a request or record it with the microphone, then review and correct the local Whisper transcript.
3. Optionally upload a PDF specification for retrieval context.
4. Generate and review the formatted result.

## Local skills

- **Test case generation** — produces 5–8 concise, risk-focused cases in Given–When–Then format by default.
- **Markdown document creation** — produces a compact, copy-ready Markdown document without unnecessary commentary.

Skill instructions and generation settings live in `src/python/skills/registry.py`.

## Technology

- Electron, TypeScript, Vite, and Express
- Server-Sent Events (SSE) for streamed model output
- Ollama with `gemma4:latest` for chat
- Ollama with `nomic-embed-text` for document embeddings
- OpenAI Whisper running locally for speech-to-text
- LangChain, ChromaDB, and PyPDF for local document retrieval

## Prerequisites

- Node.js 18 or newer
- Python 3.11 recommended
- Ollama
- FFmpeg
- PortAudio when required by PyAudio

Download the local models once:

```bash
ollama pull gemma4:latest
ollama pull nomic-embed-text
```

## Setup

```bash
npm install
python3 -m venv venv_creativemate
source venv_creativemate/bin/activate
pip install -r requirements.txt
npm start
```

On Windows, activate the environment with:

```powershell
venv_creativemate\Scripts\activate
```

## Development checks

```bash
npm run lint
npm run typecheck
npm test
```

Build an installer or package for the current platform with:

```bash
npm run package
npm run make
```

The bundled Python virtual environment contains platform-specific executables. Release packages must therefore be built and verified separately on each target operating system and architecture.

## Local interfaces

The Electron preload exposes:

- `getServerPort()`
- `getServerUrl()`
- `getApiToken()`
- `requestMicrophoneAccess()`

The authenticated API is bound to a random port on `127.0.0.1`:

- `POST /prompt` — multipart request with SSE output; accepts `test_case_generation` or `document_creation` in the `skill` field
- `POST /transcribe-audio` — local Whisper transcription
- `POST /upload-document` — local PDF ingestion
- `GET /health` — local API health

SSE event types remain `transcription`, `chunk`, `error`, and `complete`.

## Privacy boundaries

- The renderer cannot navigate to external pages or open new windows.
- The local API requires a random token generated for each application launch.
- Prompts and document contents are not written to application logs.
- Knowledge-base data is stored in Electron's per-user application-data directory.
- Browser speech recognition is not used; microphone audio is sent only to local Whisper.
- No analytics, cloud inference, or cloud fallback is configured.

Ollama and Python/model installation may require internet access initially. Operating-system behavior and third-party dependencies should still be reviewed before making formal regulatory or security claims.
