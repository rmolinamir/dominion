# @atomly/dominion-node

Node.js execution for [Dominion](https://github.com/rmolinamir/dominion). Requires Node.js 22.20.0 or later
and the matching compatible `@atomly/dominion-core` peer dependency. Packages are ESM-only.

```sh
pnpm add @atomly/dominion-core @atomly/dominion-node
```

Define aggregates and commands with `@atomly/dominion-core`. Run an existing aggregate command with
`execute(command, input, { transactions, logger?, providers? })`. Expected failures return
`{ ok: false, error }`. Successful calls return `{ ok: true, value, events }`. Unexpected handler or
adapter failures reject the promise.

During a command handler, `raise`, `useTransaction`, `useLogger`, and `useProvider` use the active
AsyncLocalStorage scope. Create typed provider identities with `createProviderToken<T>(name)` and
supply bindings through execution options. Hooks require an active execution scope.

Each execution uses an independent transaction, including nested calls. A committed nested call
stays committed if its caller later fails. Aggregate revisions detect concurrent writes. Dominion
does not automatically retry commands.

## Testing

```ts
import { execute } from '@atomly/dominion-node'
import { createMemoryStore } from '@atomly/dominion-node/testing'

// Counter and increment are your core aggregate and command definitions.
const memory = createMemoryStore()
memory.seed(Counter, { id: 'counter-1', count: 0 })
const result = await execute(
  increment,
  { id: 'counter-1' },
  {
    transactions: memory.transactions,
  },
)
const stored = memory.inspect(Counter, 'counter-1')
```

`seed` supplies existing aggregate state. `inspect` returns a snapshot with `state` and `revision`,
or `undefined` when absent. The adapter provides process-local transaction behavior for tests.
It is not a production database.

Raised events are validated and returned after a successful commit. This package does not provide
durable event storage, delivery, or automatic event-handler dispatch. Postgres, Redis, Express
adapters, and the analyzer are not implemented yet.

See the [complete working example](https://github.com/rmolinamir/dominion#getting-started) and
[package boundaries](https://github.com/rmolinamir/dominion/blob/main/docs/packages.md). MIT licensed.
