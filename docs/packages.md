# Packages

Dominion separates portable definitions from runtime execution. Both public packages are ESM-only
and ship JavaScript and TypeScript declarations in `dist`. The repository requires Node.js 22.20.0
or later. The root workspace is private.

## @atomly/dominion-core

Core defines entities, aggregates, invariants, commands, explicitly named events, event handlers,
domains, and contexts. Schemas implement Standard Schema. Aggregate storage and transaction
capability contracts also live here so adapters can implement them without owning the domain model.
Core imports no Node.js APIs and does not start services or execute commands.

`defineDomain(name, { aggregates, commands, events, eventHandlers })` records named definitions.
`defineContext(name, { domains })` records a typed object of domains. Both are passive catalogs.
There is no startup step, binding step, generated domain factory, or duplicate command-handler layer.

All event definitions have public, stable, explicit names. The event version policy is still open.
An event catalog does not imply a message broker or automatic dispatch.

## @atomly/dominion-node

The main entry point exports `execute` and the execution hooks. Node.js AsyncLocalStorage supplies
the active transaction, logger, provider bindings, and raised-event buffer. A command validates input,
loads one existing aggregate, runs its handler, validates state and invariants, and saves with an
expected revision. Expected failures return structured errors. Unexpected failures reject.

Each `execute(command, input, { transactions, ... })` call starts an independent transaction.
Nested execution does not join the caller's transaction. This means a nested commit can survive a
later failure in the caller. Aggregate revisions detect conflicting writes, without automatic retries.

The `@atomly/dominion-node/testing` subpath exports `createMemoryStore`. Its `transactions`, `seed`,
and `inspect` API supports isolated tests without a database. Raised events are returned after commit.
There is no durable event delivery or automatic event-handler execution in this initial runtime.

## Future packages

Postgres, Redis, and Express adapters should become packages when they contain real implementations.
Do not add empty adapter packages. Technology-specific implementation belongs in those adapters,
while portable capability contracts belong in core. An analyzer would be a separate development
package. None of these integrations is available in the initial release.

## Distribution checks

`pnpm build && pnpm pack:check` packs both public packages with pnpm. The check verifies public ESM
metadata, export targets, declarations, licenses, and the file allowlist. It rejects source files,
tests, configuration files, and unresolved `workspace:` ranges. It then installs both tarballs in a
clean temporary consumer and checks imports for core, node, and node/testing, plus TypeScript use.

The release workflow repeats quality and distribution checks before preparing its publish artifacts.
Changesets tracks package versions independently and updates dependent ranges when needed.
See [release setup](../README.md#releasing) for npm ownership and trusted-publisher prerequisites.
