# Core Concepts

## Current Direction

The core consumer API uses explicit, typed composition and ordinary TypeScript functions.
The examples below are illustrative API sketches, not implemented interfaces.

- `defineDomain` composes existing definitions into a typed domain interface.
- `defineContext` composes domains into a passive context definition.
- `defineAggregate` defines a root and its consistency boundary.
- `defineEntity` defines identifiable state, including children owned by an aggregate.
- `defineCommand` defines an executable operation, including its input and behavior.
- `defineEvent` defines a fact that consumers can react to.
- `defineEventHandler` defines a reaction to an event.
- Queries and domain services remain relevant concepts. Their final definition APIs are open.

A command does not need a separate command-handler definition or a forwarding application
service. This supersedes the earlier `defineCommandHandler` and `defineApplicationService`
examples. The framework does not require an effects DSL, emitter factories, or duplicate
`emits` and `publishes` lists.

## Domains and Contexts

```ts
export const GiftCard = defineAggregate('giftCards.GiftCard')
  .schema(
    z.object({
      id: z.string(),
      remainingValue: z.number().int().nonnegative(),
      currency: z.string()
    })
  )
  .id((card) => card.id)

export const CardRedeemed = defineEvent('giftCards.CardRedeemed')
  .schema(
    z.object({
      cardId: z.string(),
      transactionId: z.string(),
      amountMinor: z.number().int().positive(),
      currency: z.string()
    })
  )

export const redeemCard = defineCommand('RedeemCard')
  .input(
    z.object({
      cardId: z.string(),
      transactionId: z.string(),
      amountMinor: z.number().int().positive()
    })
  )
  .aggregate(GiftCard)
  .target((input) => input.cardId)
  .handle((input, card) => {
    if (input.amountMinor > card.remainingValue) {
      return reject({ code: 'INSUFFICIENT_BALANCE' })
    }

    card.remainingValue -= input.amountMinor

    raise(CardRedeemed, {
      cardId: card.id,
      transactionId: input.transactionId,
      amountMinor: input.amountMinor,
      currency: card.currency
    })
  })
```

Schemas stay with their definitions. Examples use Zod, while the validation direction remains
Standard Schema compatibility. Wire-schema export may need a narrower supported subset.

Definitions are created first and then composed into a domain. References can be imported
from separate files:

```ts
export const giftCards = defineDomain('giftCards', {
  aggregates: { GiftCard },
  commands: { redeem: redeemCard },
  events: { CardRedeemed }
})
```

This object defines the domain's typed interface. TypeScript can infer
`giftCards.commands.redeem` from the supplied definitions. A scoped factory could mutate a
runtime registry, but it would not automatically widen the type of an existing domain variable.

A context composes those domains through a named object:

```ts
export const commerce = defineContext('commerce', {
  domains: { giftCards, checkout }
})
```

Here, a domain is a named group of related definitions. A context composes those groups.
A framework domain does not automatically correspond to a DDD subdomain or bounded context.
Context ownership, language, and relationships still matter independently of deployment.

A domain may be reused in more than one context. This can indicate a design smell, but it
must not be prohibited. Any analyzer diagnostic for this reuse should be configurable.

Contexts do not start, open connections, or own server lifecycle. A host such as NestJS
uses their definitions. The host integration interface remains open.

## Aggregates and Child Entities

An entity has identity. An aggregate defines the root and owned state that must remain
consistent together. The distinction must affect execution and persistence, not just naming.

```ts
export const OrderLine = defineEntity('OrderLine')
  .schema(
    z.object({
      id: z.string(),
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitPriceMinor: z.number().int().nonnegative()
    })
  )
  .id((line) => line.id)

export const Order = defineAggregate('Order')
  .schema(
    z.object({
      id: z.string(),
      status: z.enum(['draft', 'submitted']),
      lines: z.array(OrderLine.schema)
    })
  )
  .id((order) => order.id)
  .children({ lines: OrderLine })
```

The proposed `.children(...)` method records ownership and child identity. Children load and
persist through the root, even if an adapter stores them in separate tables. They do not
have an independent write repository. The root revision protects the entire aggregate.

The final syntax for invariant attachment and initial state is unresolved. Every aggregate
write must validate its resulting state and mandatory invariants. New aggregates need complete
initial state, including child collections, rather than mutations of undefined fields.

## Events and Reactions

All events are public. There is no separate integration-event definition or optional public
visibility marker. Public availability does not require broadcasting every event everywhere.

A receiving context can import an event schema and type without importing the producer's
implementation. A producer-owned package is one possible distribution mechanism. Event identity
must survive file or local export renames. An explicit event name scoped by its domain is the
current basis for that identity. The initial implementation uses an explicit qualified event
name, such as `giftCards.CardRedeemed`; composing a domain does not rewrite it. Package generation
and versioning remain open.

```ts
// CardRedeemed is imported from the producer's public event definitions.
export const onCardRedeemed = defineEventHandler('RecordRedemption')
  .on(CardRedeemed)
  .handle(async (event) => {
    return recordRedemption.execute({
      transactionId: event.transactionId,
      sourceCardId: event.cardId,
      amountMinor: event.amountMinor,
      currency: event.currency
    })
  })
```

The receiver translates facts into its own operations and language. Queue names, publishers,
subscriptions, and distribution across replicas belong to adapters and deployment configuration.

## Catalog and Analyzer

Explicit domain composition supplies the definition catalog and typed interface. References to
imported definitions also load their modules. A file not referenced by composition is not
implicitly included. An optional diagnostic for unintentionally omitted definitions remains
an open tooling choice.

The composition list defines membership. It does not duplicate behavioral relationships such
as which events a command raises; those remain the analyzer's responsibility.

The analyzer inspects TypeScript symbols to discover relationships such as:

- Events raised by commands.
- Provider and repository lookups.
- Calls between commands, queries, and other operations.
- Definition names and source locations.

Ordinary handlers remain ordinary TypeScript. Dynamic selection and indirect calls may leave
relationships unresolved. Catalogs must distinguish known, unresolved, and runtime-observed
relationships rather than claim complete analysis.

Analyzer strictness is configurable. Which findings are informational, warnings, or errors
is a project policy. Whether execution requires a generated catalog is still open.

## Related Documents

Execution and concurrency are described in [Runtime Model](004-runtime-model.md).
Host integration is described in [Host Integration](005-application-services.md).
Remaining decisions are collected in [Open Questions](010-open-questions.md).
