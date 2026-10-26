# Infrastructure

The core defines domain behavior. A host such as NestJS supplies infrastructure, dependencies,
controllers, and application lifecycle. Passive contexts do not manage startup or connections.

## Providers and Execution Scope

Explicit dependency registration remains the direction. Abstract classes or symbols may serve
as provider tokens. Concrete adapters can be class-based while domain handlers remain functions.
The final bridge to a host's IoC container is not settled.

ALS-backed hooks can expose:

- `useRepository`
- `useProvider`
- `useLogger`
- `useMetrics`
- `useTracer`
- `useTransaction`

Provider lifetimes, overrides, disposal, behavior outside execution, and isolation between hosts
remain open. Reusable definitions must not retain execution-specific dependencies.

## Adapter Responsibilities

Persistence adapters enforce aggregate writes and atomic concurrency checks. Transaction
adapters implement commit and rollback. Messaging adapters map operation and event definitions
to concrete publishers, queues, and subscriptions.

Queue names, publisher configuration, FIFO ordering, replica distribution, acknowledgements,
retries, deduplication, and replay are infrastructure concerns. The core event handler declares
which event it reacts to without carrying a deployment topology.

Durable event delivery can use an outbox and consumer-side completion tracking. Those mechanisms
remain behind adapters. Their guarantees must match the configured persistence transaction.
A local EventEmitter implementation alone does not provide durable acceptance.

Boundary-owned secondary adapters can wrap payments, AI SDKs, password hashing, and other
external capabilities. The framework does not need to reimplement those libraries.

## Catalog Tooling

Explicit domain composition defines membership and preserves inferred TypeScript types. An
analyzer enriches that catalog with symbol-based relationships, source locations, and
diagnostics. Strictness is configurable.

The analyzer must expose unresolved relationships rather than inventing a complete graph.
Whether a host needs generated metadata and whether omitted definitions receive a diagnostic
are open questions. Referencing definitions in composition provides their normal import path.

## Configuration

Host integration, environment configuration, adapter selection, credentials, and provisioning
interfaces remain open. No new application or context-startup abstraction has been agreed.
