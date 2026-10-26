# Repositories

Repositories are persistence ports for aggregate roots and read access. They load roots with
their owned children and participate in the active execution transaction.

## Aggregate Writes

A loaded aggregate includes state and a revision. Saving must atomically compare that revision
with the stored revision before changing state. A blind upsert is insufficient.

An illustrative adapter contract is:

```ts
type LoadedAggregate<TState> = {
  state: TState
  revision: number
}

type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; code: 'CONCURRENT_MODIFICATION' }
```

The transaction must cover root and child writes. An adapter may use multiple tables, but a
child cannot be saved through an independent write repository. The root remains the consistency
boundary. New roots require atomic uniqueness checks.

The core must receive a structured conflict rather than treating an unchecked write as success.
Revision representation and the final load/save interface remain open.

## Transactions and Delivery

Repositories use the transaction supplied by the command execution scope. A `useTransaction()`
hook is proposed alongside existing logger and provider hooks.

Delivery adapters may coordinate outbound event records with state persistence. The integration
must state its guarantees without requiring business handlers to manage outbox records.

## Registration and Reads

The host supplies concrete repositories. Explicit token registration and repository-declared
aggregate ownership remain possible integration approaches. Neither has been selected as the
final consumer API.

Queries can use repository read access without modifying aggregate state. Advisory reads must
not replace concurrency-protected checks during a write. Query result schemas must represent
missing values explicitly when a query can return `null`.

Separate projections, read-model definitions, repository access across domains, and query
execution syntax remain open design questions.
