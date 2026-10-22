# Session Handoff

Last updated: 2026-10-12 (Australia/Melbourne)

## Project direction

Build a local-first testing IDE around Ollama. Each application under test is represented by a project with its own requirements, tools, files, AI context, and conversation memory. The integrated terminal is intended for running Playwright and invoking local coding agents.

## Current implementation

- The left panel supports multiple projects and a per-project file explorer.
- The center workspace has **Requirements** and **Tools** tabs.
- Markdown requirements can be imported and rendered in the Requirements tab.
- The Tools tab contains an integrated `xterm` terminal.
- The wider right-side AI assistant uses Ollama and currently targets `gemma4:latest`.
- Test-case generation produces concise Given/When/Then artifacts.
- Document creation currently targets formatted Markdown only.
- AI responses are rendered as formatted Markdown in the UI.
- Voice transcription exposes editable transcript text before it is submitted.

## Context and memory management

The AI panel includes a per-project context manager opened with **Context · N**.

- Focused context entries can be added as a requirement or memory note.
- Each entry can be enabled, excluded, edited, or deleted.
- Successful user and assistant messages are saved as conversation memory.
- Conversation memory is separated by skill: test-case generation and document creation.
- Individual messages can be enabled, excluded, edited, or deleted.
- The current skill's conversation can be cleared.
- Only enabled focused context and enabled messages for the active skill are sent to Ollama.
- Imported Markdown requirements are not automatically sent in full.
- AI state is persisted per project and validated with size/count limits.

## Important implementation files

- `src/projects/projectService.ts` — project model, persistence, context, and memory parsing.
- `src/main.ts` — Electron IPC, including AI-state persistence.
- `src/preload.ts` — renderer API for project AI-state updates.
- `src/global.d.ts` — context and conversation-memory types.
- `src/renderer.ts` — project UI, context manager, prompt submission, and memory behavior.
- `src/index.css` — application and context-manager styling.
- `src/routes/pythonRoutes.ts` — prompt request validation and context forwarding.
- `src/python/llmUtils.py` — Ollama model configuration, skill/system prompts, and context assembly.
- `tests/project.service.test.cjs` — project/context persistence tests.
- `tests/server.contract.test.cjs` — server prompt-contract tests.

## Verification completed

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- Python files were syntax-checked with AST parsing — passed.
- `npm test` — 16 tests passed.
- `npm run package` — passed.
- The packaged macOS app was visually checked, including adding context and persisting a real user/assistant turn.

Packaged app:

`out/creativemate-app-darwin-arm64/creativemate-app.app`

## Current persisted test state

- Project: `dynalinked`
- Requirements file: `requirements.md`
- The project contains a real saved conversation about testing unique short codes and redirect target URLs.
- Treat this as user data; do not modify or delete it without approval.

## Known limitations and next candidates

- The selected-character estimate covers focused context and conversation memory only. It excludes system/skill prompts and retrieved PDF chunks.
- PDF/Chroma retrieval is global rather than isolated per project, so PDFs could mix across projects.
- Focused context must be added manually; the app does not yet select portions of imported Markdown requirements.
- Context is stored locally in Electron's `projects-state.json`.
- The working tree contains existing modified and untracked files from ongoing development. Preserve unrelated changes and inspect before editing.

## Recommended next-session flow

1. Ask for the user's early testing feedback and reproduce any reported issue.
2. Inspect the relevant implementation before changing it.
3. Keep fixes small and avoid changing dependencies, `.env` files, or database schemas without approval.
4. Run the relevant checks and report only commands that were actually executed.

