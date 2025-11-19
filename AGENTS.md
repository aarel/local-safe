# Repository Guidelines

## Project Structure & Module Organization
The root directory houses the Codex launchers `rolemodel-init.js` and `rolemodel-init1.js`, along with the agent contract `Agent.LocalSafe_Developer.yaml` and `package.json`. Treat these scripts as the only entry points; place reusable runtime logic in `src/`, grouping encryption helpers under `src/crypto/` and UI orchestration under `src/app/` (create the folders as needed). Keep sample vault payloads and other fixtures under `assets/`, and prefer `tests/fixtures/` for anything that needs to be consumed by automated tests so the runtime stays dependency-light.

## Build, Test, and Development Commands
Run `npm install` in the repository root to make sure `js-yaml` and any new dependencies are available. During development, execute `node rolemodel-init.js Agent.LocalSafe_Developer.yaml` to boot the interactive Codex session that exercises the latest logic; use `node rolemodel-init1.js Agent.LocalSafe_Developer.yaml` when you need a straightforward prompt injection without the interactive shell. When adding build steps (for example bundling or transpilation), expose them through `npm run <task>` scripts so contributors share a common entry point. A lightweight TUI is available via `npm run tui` for operations workflows (view, info, add, update, soft-delete/restore, filters, monitor mode, audit summaries, integrity checks) without touching the main CLI.

## Coding Style & Naming Conventions
JavaScript files should follow 2-space indentation, `const`/`let` semantics, camelCase functions, and PascalCase classes. Keep modules small and default-export the launcher surface while exposing utilities as named exports. Favor async/await over raw promises and wrap filesystem calls in safe helpers that validate paths before access. Run `npx prettier --check "src/**/*.js" "tests/**/*.js"` prior to opening a pull request to avoid formatting churn.

## Testing Guidelines
Adopt Node’s built-in test runner (`node --test tests/**/*.test.js`) for unit coverage, and structure describe blocks around feature slices such as `crypto` or `vault`. Place mocks under `tests/mocks/` and load shared fixtures via relative paths to keep offline guarantees intact. Aim for minimum 85% statement coverage and add regression tests whenever you fix a bug.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `docs:`) so downstream automation remains predictable. Each pull request should summarize the change, reference the driving issue or ticket, and include screenshots or CLI transcripts if behavior changed. Note any security-sensitive decisions in the PR body so reviewers can double-check threat assumptions.

## Security & Configuration Tips
Never commit real vault material or API keys; rely on scrubbed fixtures. Document any new configuration flags inside the YAML role definition and mirror them in README usage notes. If a change affects encryption defaults, call it out prominently in both the PR and `Agent.LocalSafe_Developer.yaml`.
