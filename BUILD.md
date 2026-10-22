# Build state: CreativeMate Testing IDE

## Control

- Project status: `awaiting_approval`
- Updated: 2026-10-11
- Active milestone: M-1 — Explorer and terminal foundation
- Next task: T-002 — Add the approved terminal dependencies and secure IPC contract
- Current blocker: G-001 — dependency approval

## Outcomes

| ID | Outcome | Target | Current | Validation |
|---|---|---|---|---|
| O-1 | Open testing workspace | Select, browse, refresh, and reopen a folder | No workspace explorer | Packaged-app workflow |
| O-2 | Controlled local AI assistance | Context-aware test and Markdown generation | Two local skills exist | AI evaluation pack |
| O-3 | Interactive integrated terminal | Run Playwright, Ollama, Codex CLI, and Claude Code in the workspace | No terminal | Interactive packaged-app checks |
| O-4 | Bounded local access | Workspace-scoped files and session-scoped processes | Existing IPC is narrow but lacks workspace/PTY APIs | Security and lifecycle tests |

## Milestones

| ID | Milestone | Outcomes | Status | Exit evidence |
|---|---|---|---|---|
| M-1 | Explorer and terminal foundation | O-1, O-3, O-4 | `awaiting_approval` | Workspace explorer and interactive terminal demonstrated in packaged app |
| M-2 | Workbench integration | O-1, O-2, O-3 | `backlog` | Explorer, AI workbench, and terminal operate together |
| M-3 | Quality and release hardening | O-1, O-2, O-3, O-4 | `backlog` | Security, accessibility, packaging, and recovery checks pass |

## Capability map

| Requirement | Capability | Selected implementation | Why this execution level | Availability and evidence | Evaluation / fallback |
|---|---|---|---|---|---|
| IDE shell | Deterministic desktop workspace UI | Existing Electron, TypeScript, and DOM renderer | Reuses the current stack without a dependency | `VERIFIED`: packaged app runs | Rendered keyboard and layout checks |
| Workspace explorer | Enumerate a user-selected local folder | Node file-system APIs behind narrow Electron IPC | No new data model or database is required | `VERIFIED`: Electron main/preload architecture exists | Root-boundary and symlink checks |
| Test generation | Structured local text generation | Existing Ollama skill registry | Already implemented and locally exercised | `VERIFIED`: smoke and contract tests | Golden Given–When–Then cases; manual edit fallback |
| Document generation | Concise Markdown generation | Existing Ollama skill registry | Already implemented and locally exercised | `VERIFIED`: smoke and contract tests | Markdown structure checks; manual edit fallback |
| Interactive terminal | Emulate terminal UI and host a real pseudo-terminal | `@xterm/xterm`, `@xterm/addon-fit`, and `node-pty` behind typed IPC | Interactive CLIs require PTY semantics, ANSI support, and resize | `ASSUMED`: official xterm/node-pty approach; install approval pending | If native rebuild fails, stop and report rather than degrade to a fake terminal |
| Process lifecycle | Create, resize, write, interrupt, and terminate session processes | Electron main process owns PTY sessions | Keeps shell access out of the renderer | `ASSUMED`: implementation pending | Lifecycle and shutdown tests |

## AI evaluation assets

| Capability | Evaluation pack | Acceptance threshold | Current implementation | Last result | Rerun trigger |
|---|---|---|---|---|---|
| Test generation | Representative positive, negative, boundary, sparse, and ambiguous requirements | At least 90% format compliance; no unsupported critical outcomes | Ollama `gemma4:latest` plus test-case skill | Initial smoke passed; full pack not created | Model, prompt, skill, or context change |
| Markdown generation | Release note, test plan, checklist, and sparse-input cases | Valid lean Markdown with no invented material facts | Ollama `gemma4:latest` plus document skill | Initial smoke passed; full pack not created | Model, prompt, skill, or context change |

## Operational outcome measures

| Outcome | Successful completions | Total execution cost | Cost per successful outcome | Reliability / latency / human correction | Evidence window |
|---|---:|---:|---:|---|---|
| Local AI artifact generation | Not measured | Local compute | Not measured | Baseline required | Initial IDE milestone |

## Definition of Done

- A tester can open a local folder and navigate its file hierarchy.
- A real terminal opens in that folder and supports interactive CLI input, ANSI output, resize, interrupt, exit, and application cleanup.
- Existing test-generation, Markdown, Whisper, and document-context workflows remain operational.
- AI context is explicit, local, bounded, and recoverable when Ollama is unavailable.
- Core workflows are keyboard-operable and visually inspected in the packaged app.
- Lint, type checks, contract tests, AI evaluations, and packaging pass.
- Playwright and at least one installed interactive CLI are exercised through the packaged terminal.

## Task board

| ID | Outcome | Deliverable | Depends on | Status | Owner | Validation |
|---|---|---|---|---|---|---|
| T-001 | O-1–O-4 | Narrowed vision, capability map, and UI concept | — | `done` | AI PM | Repository inspection, project documents, preview concept |
| T-002 | O-3, O-4 | Approved terminal dependencies and typed PTY IPC contract | G-001 | `awaiting_approval` | AI PM | Install/rebuild plus IPC tests |
| T-003 | O-1, O-4 | Workspace chooser and root-bounded file explorer | T-002 | `backlog` | AI PM | Explorer contract and packaged workflow tests |
| T-004 | O-3, O-4 | Resizable terminal panel with PTY lifecycle | T-002 | `backlog` | AI PM | Shell, ANSI, resize, interrupt, exit, cleanup checks |
| T-005 | O-1, O-2, O-3 | Integrate explorer and terminal with existing AI workbench | T-003, T-004 | `backlog` | AI PM | Rendered core-workflow verification |
| T-006 | O-1–O-4 | Security, accessibility, recovery, and packaging hardening | T-005 | `backlog` | AI PM | Definition of Done reconciliation |

## Approval queue

| ID | Action or decision | Trigger | Options and recommendation | Status |
|---|---|---|---|---|
| G-001 | Add `@xterm/xterm`, `@xterm/addon-fit`, and `node-pty` | A genuine interactive terminal cannot be implemented reliably with the current dependency set | Recommend approval; these provide the terminal UI, fitting, and PTY process | `pending` |

## Decisions and assumptions

| ID | Date | Decision or assumption | Reason | Impact |
|---|---|---|---|---|
| D-001 | 2026-10-11 | Treat “like VS Code” as an IDE interaction model, not a VS Code clone | Keeps the product focused on tester workflows | Explorer/editor/assistant/output layout only |
| D-002 | 2026-10-11 | Prefer Markdown and a small JSON manifest over a database | Local, versionable, inspectable, and reversible | Database deferred |
| D-003 | 2026-10-11 | Keep Ollama behind skill and model configuration boundaries | Models and prompts will change | Requires evaluation before substitution |
| D-004 | 2026-10-11 | Use the terminal for Playwright and AI CLI execution instead of building runner integrations | Explicit scope clarification | Removes dedicated runner adapters from committed scope |

## Risks and blockers

| ID | Risk or blocker | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-001 | IDE scope expands into a VS Code clone | High | High | Commit tester workflows and explicit non-goals | Open |
| R-002 | Local model outputs vary or invent behavior | Medium | High | Structured skills, golden cases, editable artifacts | Open |
| R-003 | File-system access creates path or overwrite risks | Medium | High | Narrow IPC, workspace boundaries, atomic writes, confirmations | Open |
| R-004 | Native `node-pty` packaging or rebuild differs by OS/Electron version | Medium | High | Verify install, development launch, and packaged app on the target platform | Open |

## Validation evidence

- 2026-10-11, T-001: inspected Electron renderer, preload, local API, Ollama skill registry, tests, and package configuration; generated a preview-only full workspace concept.
- 2026-10-11, existing baseline: lint, type checks, 7 contract tests, packaging, and packaged local API were previously verified.

## Retrospective

- Required capabilities: persistent workspace, artifact editing, controlled local generation, evaluation, and optional execution adapters
- Tool and gap lessons: current Electron stack supports workspace IPC, but interactive terminals require a terminal emulator and PTY implementation
- Useful QA catches: a non-PTY command box would not satisfy interactive Codex/Claude workflows
- Reusable learning: keep renderer terminal emulation separate from main-process PTY ownership

## Activity log

- 2026-10-11: narrowed the IDE vision to an integrated workspace explorer and real terminal; paused at the dependency approval gate.

## Deferred ideas

- Full source-code editor and language services
- Extensions or plugin marketplace
- Cloud collaboration and synchronization
- Visual test comparison
- Test management system integrations
- Autonomous test maintenance
- Dedicated Playwright/API runner dashboards
