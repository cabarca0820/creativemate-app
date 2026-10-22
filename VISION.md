# Vision: CreativeMate Testing IDE

## Intent

Turn CreativeMate into a local-first desktop testing workspace where testers can open a project folder, navigate its files, and use a real integrated terminal to run Playwright, Ollama, Codex CLI, Claude Code, and normal development commands alongside the existing AI workbench.

The product should feel familiar to VS Code users without becoming a general-purpose code editor.

## Users

- Primary: manual testers, QA analysts, and test leads
- Other stakeholders: developers and product owners reviewing test coverage

## Measurable outcomes

### O-1 — A tester can open and navigate an existing testing project

- Target: choose a local folder, browse its file hierarchy, and reopen the most recent workspace
- Validation: packaged-app workflow covering open, browse, refresh, close, and reopen

### O-2 — Local AI accelerates test design without replacing tester control

- Target: generate lean Given–When–Then cases and concise Markdown documents from selected project context using a configured Ollama model
- Validation: golden prompts meet the project quality rubric and all context remains local

### O-3 — The app provides a real interactive terminal

- Target: launch the user's shell in the selected workspace and support interactive CLI input, ANSI output, resize, interrupt, and process cleanup
- Validation: run Playwright plus representative Ollama and interactive CLI commands in the packaged app

### O-4 — File and process access remains explicitly bounded

- Target: file operations stay within the selected workspace, and terminal processes exist only for the active application session
- Validation: path traversal, invalid workspace, terminal exit, and app-shutdown tests

## Acceptance criteria

- The desktop app adds a workspace file explorer and resizable integrated terminal around the existing AI workbench.
- The explorer opens a user-selected folder, displays nested files, supports refresh, and restores the last valid workspace.
- The terminal starts in the selected workspace and behaves as an interactive terminal rather than a one-command output box.
- Playwright, Ollama, Codex CLI, and Claude Code can be invoked from the terminal when they are already installed and configured on the machine.
- AI actions use only explicitly selected project context and show what context is being used.
- The current Given–When–Then and Markdown skills continue to work.
- Ollama remains local and model configuration is not hard-coded into the UI workflow.
- The packaged Electron application passes lint, type checks, contract tests, and representative rendered-workflow checks.
- No dependency, database schema, or destructive project-format change is introduced without approval.

## Constraints

- Desktop-first Electron application.
- Local-first processing with no cloud fallback.
- Ollama is the model runtime; individual model names remain replaceable configuration.
- Keep changes modular and incremental; preserve the current working skill and Whisper flows.
- Do not introduce a custom project database or proprietary project format.
- Accessibility, keyboard operation, and safe rendering are required for core workflows.

## AI execution policy

- Required AI capabilities: test generation, document generation, summarization, and requirement-to-test reasoning
- Provider/model constraint: local Ollama runtime; model is configurable and must pass project evaluations
- Evaluation requirement: golden requirements, output-format checks, unsupported-assumption checks, latency, and failure handling
- Human involvement: testers review and edit all generated artifacts before treating them as accepted

## Non-goals

- Rebuilding all VS Code functionality or adding an extension marketplace
- A general-purpose source-code IDE
- Cloud accounts, collaboration, or hosted inference in the initial product
- Autonomous modification of application source code
- Bundling or managing Playwright, Codex CLI, Claude Code, or Ollama installations
- Building a dedicated test runner integration; commands run through the terminal
- Adding a new full-featured source editor in this milestone

## Project-specific approval gates

- Adding any dependency
- Adding native terminal or renderer dependencies
- Expanding file-system access beyond the selected workspace
- Adding cloud services, accounts, telemetry, or remote inference
- Database schemas or migrations

## Open vision questions

- None after the 2026-10-11 scope clarification; dependency approval remains an implementation gate.

