# Runtime Model

Contexts are passive definitions. A host such as NestJS owns application startup, controllers,
and infrastructure lifecycle. This document describes command execution within that host.
Exact host integration APIs remain open.

## Aggregate Execution

An aggregate-bound command writes one root and its owned state:

1. Validate input and resolve the target aggregate identity.
2. Establish an execution scope and transaction through the configured infrastructure.
3. Load the aggregate state and its persistence revision, or initialize a new aggregate.
4. Run the command against a working copy, buffering raised events.
5. Validate resulting state and mandatory aggregate invariants.
6. Persist with an atomic revision check and commit the transaction.
7. Complete event handling according to the configured delivery adapter's guarantees.

Creation policies such as `always`, `never`, and `if_missing` remain candidates. Their exact
API and initialization semantics are not settled. Commands without an aggregate also need
a defined execution contract.

## Concurrency

State validation alone does not protect against concurrent writes. Persistence must reject
stale revisions atomically. A relational adapter could use:

```sql
UPDATE gift_cards
SET remaining_value = :remainingValue,
    revision = revision + 1
WHERE id = :id
  AND revision = :expectedRevision;
```

Two redemptions can both load balance 100 at revision 7 and approve spending 80. Only one
conditional update may advance revision 7 to 8. The other returns a concurrency conflict.
If retried, it reloads balance 20 and rejects the redemption.

A failed attempt discards its working state and buffered events. Child entity changes use
the root revision. Creation also requires atomic uniqueness enforcement. Revisions are
persistence metadata, not fields the business handler must maintain.

## AsyncLocalStorage and Hooks

The current direction is an AsyncLocalStorage (ALS) scope around command execution. Hooks
resolve the active transaction, logging, and providers without passing a context everywhere:

```ts
.handle(async (input, aggregate) => {
  const logger = useLogger()
  const transaction = useTransaction()

  // Resolve dependencies from this command's execution scope.
})
```

The internal shape might resemble:

```ts
await executionStorage.run(
  { transaction, logger, providers },
  () => invokeCommand(input)
)
```

ALS carries execution dependencies. The execution wrapper and adapters implement transaction
behavior. Definitions must not capture a transaction or other execution-specific state at
module construction time. Scope naming, missing-scope behavior, and host dependency resolution
remain open.

## Transactions and Retry

The framework can expose transaction and retry tools through execution infrastructure.
Rollback discards staged state and events and reverses transactional database work. It cannot
reverse an external payment, email, or previously committed operation.

A retry must reload state and rerun the command and its rules. Retrying only a stale save
would defeat concurrency protection. Business rejections are distinct from concurrency or
transaction failures. An unknown commit outcome also differs from a confirmed rollback.
The consumer-facing retry policy and error contract remain open.

Each write command has its own transaction, including when invoked by another command.
If command B commits and command A later fails, B remains committed. Nested writing commands
are a design smell, not a prohibited operation or an implicit multi-aggregate transaction.

The ALS implementation must preserve this separation: establish the nested command scope and
restore the caller scope afterward. It must not reuse the caller transaction just because
that transaction is available through ALS.

## Event Delivery and External Work

Durability is abstracted behind infrastructure adapters rather than exposed as domain setup.
An adapter claiming durable publication must support the corresponding atomic persistence
and delivery guarantees. Buffering events alone does not establish durable delivery.

Queue topology, FIFO processing, acknowledgement, duplicate handling, and replay policy are
adapter concerns. External payment work can use queued processing and explicit business states
such as `pending`, `processing`, `completed`, and `failed`. FIFO ordering does not itself make
an external operation reversible or eliminate duplicate delivery.

Immediate execution and queued processing remain distinct. The final enqueue/publish API and
acceptance semantics are open. Local and remote processing must not silently promise identical
timing or failure behavior.
