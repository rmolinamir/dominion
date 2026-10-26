# @atomly/dominion-core

Portable domain definitions, Standard Schema validation, and persistence contracts for Dominion.
This package has no Node imports. Hosts own execution, transactions, and event delivery.

```ts
import {
  defineAggregate,
  defineCommand,
  defineContext,
  defineDomain,
  reject,
} from '@atomly/dominion-core'
import { z } from 'zod'

const GiftCard = defineAggregate('GiftCard')
  .schema(z.object({ id: z.string(), remainingValue: z.number().nonnegative() }))
  .id((card) => card.id)
  .invariant({
    code: 'NEGATIVE_BALANCE',
    message: 'Balance must be nonnegative',
    check: (card) => card.remainingValue >= 0,
  })

const redeem = defineCommand('giftCards.Redeem')
  .input(z.object({ cardId: z.string(), amount: z.number().positive() }))
  .aggregate(GiftCard)
  .target((input) => input.cardId)
  .handle((input, card) => {
    if (input.amount > card.remainingValue) {
      return reject({ code: 'INSUFFICIENT_BALANCE' })
    }
    card.remainingValue -= input.amount
    return card.remainingValue
  })

const giftCards = defineDomain('giftCards', {
  aggregates: { GiftCard },
  commands: { redeem },
})

const commerce = defineContext('commerce', { domains: { giftCards } })
// commerce.domains.giftCards.commands.redeem retains the complete command type.
```

Definitions and catalog maps are frozen snapshots. Builders return fresh definitions.
Schemas and callbacks retain their original references. Definition freezing does not freeze
business state passed to a handler.

`defineEntity(name).schema(schema).id(callback)` defines child identity. Concrete schema types
are preserved, so Zod consumers can use `z.array(Line.schema)`. Attach ownership with
`Order.children({ lines: Line })`. Read the typed map through `Order.childEntities.lines`.
Calling `.children(...)` replaces the child map on a fresh definition. Calling `.invariant(rule)`
appends a rule without changing earlier definitions. Child writes belong to the root transaction
and use the root revision.

`defineEvent(name).schema(schema)` defines a public fact. Use an explicit name such as
`giftCards.CardRedeemed` for wire identity. Composition never changes that name.
`defineEventHandler(name).on(event).handle(callback)` records a reaction whose callback receives
the schema output. These definitions do not dispatch events themselves.

`validate(schema, unknownValue)` supports synchronous and asynchronous Standard Schema validators.
It returns parsed output as `{ ok: true, value }`. Invalid input returns
`{ ok: false, error: { code: 'VALIDATION_FAILED', message, details: { issues } } }`.
Schema exceptions propagate. Input and output may differ when a schema transforms data.

Handlers return success values or `reject({ code, message?, details? })` for expected business
failures. `isRejection(value)` narrows a rejection. `Result<T>` contains a success value or a
`DomainError`, with no event list. Core defines metadata rather than an execution engine.
The initial command slice requires an existing aggregate. It provides no creation or stateless
command API.

Adapters implement `AggregateStore` and `TransactionRunner`. Store loads return state and revision.
Saves must atomically compare `expectedRevision` and return `CONCURRENT_MODIFICATION` for stale
writes. The generic load contract trusts adapter deserialization. Execution must validate loaded
state against its aggregate schema. A transaction runner commits only when its callback resolves
and rolls back when the callback throws or rejects. Returning an error object still resolves
the callback, so runtimes must abort failed attempts before the runner commits.

Run runtime tests with `pnpm exec vitest run packages/core/test`. Run type checks with
`pnpm exec tsc -p packages/core/tsconfig.json`. The separate `*.typecheck.ts` file includes
expected compile failures and must remain in the TypeScript include list.
