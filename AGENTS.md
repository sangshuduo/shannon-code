# Repository Guidelines

## Project Structure & Module Organization

- Workspaces live under `packages/*`: `cli` (Ink-based CLI surface), `core`
  (shared services/config), `test-utils` (testing helpers), `a2a-server`
  (agent-to-agent server), and `vscode-ide-companion` (IDE companion extension).
- `integration-tests/` holds Vitest integration suites; `docs/` contains
  user-facing docs/assets; `schemas/` stores generated settings schemas;
  `scripts/` houses build/test helpers; `third_party/` tracks vendored assets;
  build artifacts land in `bundle/` after bundling.

## Build, Test, and Development Commands

- `npm install` (or `make install`) to set up dependencies; Node 20+ required.
- `npm run start` to launch the CLI locally; `npm run debug` starts with the
  inspector enabled.
- `npm run build` to compile all packages; `npm run build:all` adds sandbox + VS
  Code companion artifacts; `npm run bundle` prepares the release bundle.
- `npm run lint`, `npm run format`, and `npm run typecheck` keep style and types
  consistent; use `npm run lint:fix` for autofixes.
- `npm run test` for workspace unit tests;
  `npm run test:integration:sandbox:none` (no sandbox),
  `npm run test:integration:sandbox:docker`, or `:podman` for sandboxed
  coverage; `npm run test:e2e` exercises full flows.
- `npm run preflight` (or `make preflight`) before PRs to run clean +
  formatting + lint + build + tests.

## Coding Style & Naming Conventions

- TypeScript + ES modules; prefer `async/await`, typed exports from `src/`, and
  small, composable modules.
- Prettier defaults (2-space indent, trailing commas) govern formatting;
  lint-staged enforces on commit.
- ESLint config lives in `eslint.config.js`; follow React/Ink best practices in
  `packages/cli`.
- Filenames use kebab-case; React/Ink components use PascalCase; tests follow
  `*.test.ts`/`*.spec.ts` naming.

## Testing Guidelines

- Unit tests sit near source within each package; integration specs live in
  `integration-tests/`.
- Add or update tests whenever behavior changes; cover CLI output, error paths,
  and sandboxed execution where relevant.
- Run focused iterations with `vitest run path/to/file.test.ts`; debug flakes
  via `npm run test:integration:sandbox:none -- --retry=0` and capture repro
  steps.

## Commit & Pull Request Guidelines

- Use Conventional Commits (e.g., `feat(cli): add --json flag`,
  `fix(core): handle auth errors`); keep commits scoped to one change.
- PRs must link an issue, stay small, and explain rationale + user impact;
  update `docs/` when modifying commands, flags, or UX.
- Ensure `npm run preflight` is green before requesting review; include
  before/after output or screenshots for UX-facing tweaks.

## Security & Configuration

- Never commit secrets (API keys, tokens); prefer local env vars such as
  `SHANNON_API_KEY` or `OLLAMA_BASE_URL` where needed.
- Report vulnerabilities at https://g.co/vulnz before filing a public issue.
