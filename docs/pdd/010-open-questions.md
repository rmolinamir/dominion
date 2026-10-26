# Open Questions

This list separates the current direction from decisions that remain unresolved. Example APIs
elsewhere in the PDD are sketches, not implementation contracts.

## Current Direction

- Explicit `defineDomain` composition defines membership and preserves TypeScript inference.
- Contexts compose named domains through an object; referenced definitions load through imports.
- Passive `defineContext` definitions compose multiple domains and are used by a host.
- Domains can be reused across contexts, even if that indicates a design smell.
- Commands combine operation definition and behavior without a forwarding application service.
- Aggregates own child entities through the proposed `.children(...)` relationship.
- Aggregate writes need atomic concurrency protection and consistent root/child persistence.
- All events are public. There are no duplicate `emits` or `publishes` lists.
- Event identity survives local file and export renames, using an explicit domain-scoped name.
- Each write command keeps an independent transaction, including nested writes.
- Normal TypeScript is analyzed for relationships. No effects DSL or emitter factory is required.
- Analyzer diagnostic strictness is configurable.
- Durability and queue topology are abstracted behind adapters.
- ALS around commands is the proposed mechanism for transaction and provider hooks.

## Domains, Contexts, and Definitions

- Exact DDD meaning and ownership implications of domain and context composition.
- Permitted cross-domain command/query calls and repository access within one context.
- Definition completion, catalog snapshots, and repeated host use.
- Explicit names versus inferred names for local definitions.
- Whether execution requires analyzer-generated metadata.
- Whether definitions omitted from explicit composition should produce a configurable diagnostic.

## Commands, Aggregates, and Transactions

- Initial aggregate state and creation policies, including child collection initialization.
- Final invariant API, precondition/postcondition timing, and structured rejection shape.
- Commands without an aggregate and query/domain-service definition APIs.
- Analyzer diagnostics for nested writing commands, which remain allowed but considered a smell.
- Revision representation, conflict results, retry policy, and unknown commit outcomes.
- Transaction scope, `useTransaction()` capabilities, and behavior outside active execution.

## Public Events and Cross-App Use

- Exact wire identity encoding and collision handling for domain-scoped event names.
- Distribution of runtime schemas and inferred types through packages or generated artifacts.
- Package versions versus wire versions, compatible evolution, and breaking-change migration.
- Optional receiver translation when another context uses different language or models.
- Core acceptance/completion semantics exposed by command and event invocation.

## Host Integration and Providers

- How NestJS and other hosts invoke definitions and supply execution infrastructure.
- Provider lifetimes, overrides, disposal, and isolation between execution scopes.
- Identity, authorization, tenant metadata, and tracing propagation interfaces.
- Optional controller helpers without adding a required controller or application layer.
- Adapter capability contracts and configuration. Queue naming, subscription deployment,
  ordering, duplicate handling, and replay configuration stay with infrastructure.

## Capabilities With Unsettled Scope

- Projections, live queries, and reactive client subscriptions.
- Durable multi-step process orchestration beyond ordinary event reactions.
- AI tool approval, MCP adapters, model routing, quotas, and streaming contracts.
- Trace defaults and optional analyzer-generated documentation or provisioning artifacts.
