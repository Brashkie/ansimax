# Contributing to Ansimax

Thanks for your interest in contributing to Ansimax! This document explains how to set up the project locally, submit changes, and follow the conventions the project relies on.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## Quick start

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ansimax.git
   cd ansimax
   ```
3. **Install** dependencies:
   ```bash
   npm ci
   ```
4. **Create** a feature branch:
   ```bash
   git checkout -b feat/your-feature
   ```

## Requirements

- **Node.js** ≥ 18
- **npm** ≥ 9
- **TypeScript** familiarity (the project is strict-mode TypeScript)

## Development workflow

```bash
# Watch mode rebuild
npm run dev

# Run all tests
npm test

# Run a single test file
npm test -- src/__tests__/colors.test.ts

# Watch tests
npm run test:watch

# Coverage report
npm run test:coverage

# Type check (no emit)
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Production build
npm run build
```

## Project structure

```
ansimax/
├── src/
│   ├── colors/         Color rendering + gradient engine
│   ├── themes/         Theme system + 8 built-ins
│   ├── ascii/          Banners, boxes, fonts
│   ├── animations/     Typewriter, fade, slide, pulse, wave, glitch, reveal
│   ├── loaders/        Spinners, progress, tasks, multi-loader
│   ├── frames/         Sequenced playback + live renderer + morph
│   ├── components/     Tables, badges, status, timelines, menus
│   ├── images/         Sprites, canvas, dithered gradients
│   ├── trees/          Tree builder + algorithms
│   ├── utils/          ANSI primitives + helpers
│   ├── configure.ts    Global config + subscribers
│   └── __tests__/      Jest test suites (1700+ tests)
├── examples/           Production-grade example scripts
└── dist/               Build output (generated, gitignored)
```

## Commit message format

Ansimax follows [Conventional Commits](https://www.conventionalcommits.org/). The PR title is validated automatically.

**Format:** `<type>(<scope>): <subject>`

### Allowed types

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons, etc (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Changes to build system or external dependencies |
| `ci` | Changes to CI configuration files and scripts |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Revert a previous commit |

### Examples

```
feat(colors): add registerPreset and listPresets
fix(animations): swallow user-fn errors in typewriter callback
docs(readme): clarify ESM vs CJS import paths
test(loaders): cover countdown timeout edge case
ci: bump actions/checkout to v4
```

### Subject rules

- Use the imperative mood: "add feature" not "added feature"
- Start in lowercase
- No trailing period
- Keep under 72 characters

## Pull request checklist

Before opening a PR, please make sure:

- [ ] Tests pass locally: `npm test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes (or only minor warnings): `npm run lint`
- [ ] Format is correct: `npm run format:check`
- [ ] New code has test coverage
- [ ] Public API additions have JSDoc comments
- [ ] CHANGELOG.md is updated for user-facing changes
- [ ] PR title follows Conventional Commits
- [ ] PR description explains the motivation

## Code style

- **TypeScript strict mode** is required (`strict`, `noUncheckedIndexedAccess`, `noImplicitAny`)
- **ESM-first** import paths (`import x from './file.js'` even for `.ts` source — preserved through tsup build)
- **Zero runtime dependencies** is a project invariant. Do not introduce new runtime deps without prior discussion.
- **Defensive code** should be marked with `/* istanbul ignore next — <reason> */` when the path is not realistically reachable in tests
- **Public APIs** should be exported via the `src/index.ts` barrel

## Testing

Ansimax has 1700+ tests in `src/__tests__/`. Coverage targets:

- Statements: ≥ 98%
- Branches: ≥ 95%
- Functions: ≥ 99%
- Lines: ≥ 99%

When adding new features:

1. Write tests **first** (TDD encouraged but not required)
2. Use `setNoColor(true)` / `setNoColor(false)` and `resetColorSupportCache()` for color tests
3. Use `jest.useFakeTimers()` for time-dependent code
4. Test the happy path AND edge cases (NaN, Infinity, null, empty input)

## Areas where contributions are especially welcome

- **New animation presets** (easings, spring physics)
- **Additional ASCII fonts** (`.flf` figlet parser)
- **Terminal capability database** entries
- **Translations** (es, fr, de, ja, …)
- **Real-world example apps**
- **Chart implementations** (Phase 10 of the roadmap)
- **Markdown rendering** (Phase 4 of the roadmap)

See the [Roadmap](../README.md#%EF%B8%8F-roadmap) section in the README for the full list of planned features.

## Reporting bugs

Please use the [bug report template](ISSUE_TEMPLATE/bug_report.yml). Include:

- Node.js version (`node --version`)
- Terminal emulator (and OS)
- Minimal reproducible example
- Expected vs actual behavior

## Reporting security issues

**Do not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](../LICENSE) that covers the project. The Apache 2.0 license includes an explicit patent grant, which we require from all contributors.

---

Thank you for making Ansimax better! 🎉
