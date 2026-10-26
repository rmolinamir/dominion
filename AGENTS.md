# AGENTS.md

This file provides guidance for agentic coding assistants working in this repo.
It captures build/test commands, coding conventions, and repo-specific context.
If these instructions conflict with system/user instructions, follow those.

## Repository overview

- Dominion is a domain-first TypeScript library with two public packages.
- `packages/core` contains portable definitions, Standard Schema validation, and capability contracts.
- `packages/node` contains Node.js execution, AsyncLocalStorage hooks, and the `/testing` memory adapter.
- `docs/packages.md` describes implemented package boundaries. Design docs in `docs/pdd/` include future work.
- No Postgres, Redis, Express adapters or analyzer are implemented yet.

## Tooling and commands

Use Node.js >=22.20.0 and pnpm 10.12.4. Install with `pnpm install --frozen-lockfile`.
The root pins OXC (oxlint 1.89.0, oxfmt 0.74.0), TypeScript 7, Vitest 5, and Changesets 3.0.3.

- `pnpm build`: build package declarations and ESM JavaScript with recursive TypeScript builds.
- `pnpm lint` / `pnpm lint:fix`: run OXC lint using `tooling/oxlint.json`.
- `pnpm format` / `pnpm format:check`: write or check formatting using `tooling/oxfmt.json`.
- `pnpm typecheck`: build dependencies, check package types, and check the root example.
- `pnpm test`: run Vitest once.
- `pnpm exec vitest run packages/core/test/definitions.test.ts`: run one test file.
- `pnpm exec vitest run -t 'test name'`: run matching tests.
- `pnpm exec vitest run packages/node/test`: run one package's tests.
- `pnpm check`: run lint, format checks, builds, strict type checks, tests, and package checks.
- `pnpm pack:check`: inspect built pnpm tarballs and check a clean consumer. Run the build first.
- `pnpm changeset`: describe a publishable change and choose affected packages.
- `pnpm version-packages`: apply changesets and update the lockfile.
- `pnpm release`: build and actually publish to npm. Do not use this command for validation.

CI runs quality and tarball checks on Node.js 22.20.0 and 24. Releases use Changesets v3-compatible
sub-actions in `.github/workflows/release.yml`. Merging the version pull request enables automatic
public publishing after checks pass. npm ownership and trusted publishers require maintainer setup,
as described in README.md. Do not infer npm scope ownership from GitHub access.

## Code style guidelines

Follow the checked-in OXC configuration and the conventions below.

### Language and module style

- Default to TypeScript for new code unless stated otherwise.
- Prefer ES module syntax (`import`/`export`) over `require`/`module.exports`.
- Keep files small and focused; avoid multi-concern modules.

### Imports

- Group imports by source:
  1. Node built-ins
  2. External dependencies
  3. Internal modules
- Separate groups with a single blank line.
- Use named imports over default when the library supports it.
- Avoid deep relative import chains; prefer scoped internal paths when added.

### Formatting

- Use 2-space indentation and let oxfmt format changed files.
- Prefer single quotes in JS/TS and omit semicolons, as configured by oxfmt.
- Keep lines reasonably short (around 100 characters).
- Avoid trailing whitespace and keep a newline at EOF.

### Types

- Use explicit types for public APIs and exported functions.
- Prefer type aliases for data shapes and interfaces for contracts.
- Avoid `any`; use `unknown` and narrow when needed.
- Model domain concepts with strong types instead of primitives.

### Naming conventions

- Use `camelCase` for variables/functions.
- Use `PascalCase` for types, classes, and constructors.
- Use `SCREAMING_SNAKE_CASE` for constants only when truly global.
- Names should reflect domain language from the docs.

### Error handling

- Validate input at the boundary (schema validation or equivalents).
- Prefer returning structured errors over throwing for expected failures.
- Throw only for programmer errors or truly exceptional conditions.
- Include context (domain identifiers, command names) in error payloads.

### Asynchronous behavior

- Use `async`/`await` for readability.
- Avoid unhandled promise chains; always return or await.
- Prefer explicit command enqueue/execute semantics for domain actions.

### Logging and observability

- Use structured logging with consistent fields when introduced.
- Propagate trace context when the tracing stack is added.
- Avoid logging sensitive data.

### Domain modeling guidance

- Encode domain language directly in names (commands, events, queries).
- Keep invariants close to the domain model.
- Core must remain portable: do not import Node.js APIs into `packages/core`.
- `defineDomain` and `defineContext` are passive, typed catalogs. Do not add startup or binding behavior.
- Commands target one aggregate and use optimistic concurrency. Nested execution has an independent transaction.
- Events have stable, explicit public names. Do not assume a settled event version policy.
- Keep technology-specific code in real adapters. Do not add empty adapter placeholders.
- Do not add application-service or command-handler layers that duplicate command definitions.
- Keep host transport concerns separate from domain rules without forwarding service layers.
- Use events to express facts, commands to express intent, queries to ask.

## Documentation conventions

- Keep docs concise and narrative.
- Prefer examples that reflect the contents in `docs/`.

## Cursor/Copilot rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`
  files exist in this repo currently.
- If these are added later, include their requirements here.

## When making changes

- Make minimal, focused edits.
- Do not introduce new files unless required.
- Keep new content aligned with the domain-first principles in `docs/`.
