# User Stories

These stories illustrate the current direction. APIs are sketches, and host invocation,
creation initialization, and event versioning remain open. They do not introduce a required
application-service layer.

## Define a Gift-Card Domain

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
```

Definitions are composed into a typed domain after they are declared. Composition references
load definitions imported from other modules and make their types available to consumers.

## Issue a Gift Card

A host controller validates transport concerns and supplies a new card identifier. The issue
operation creates an aggregate with a complete initial state, checks invariants, and records
`CardIssued` as its outcome.

Initial state must contain `id`, `remainingValue`, and `currency`. It must not depend on adding
to an uninitialized balance. Creation policy and initial-state syntax are still undecided,
so this story does not prescribe a creation builder.

## Redeem a Gift Card

```ts
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
    const logger = useLogger()

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

    logger.info('Redemption staged', {
      transactionId: input.transactionId
    })
  })
```

Execution loads the aggregate and revision, runs business checks, validates resulting state,
and performs a conditional write. The event is buffered until the attempt succeeds. Logging
that a change is staged does not claim that its transaction committed.

Two concurrent redemptions of 80 against balance 100 may both pass their initial check. Only
one may commit against the loaded revision. A retried loser reloads balance 20 and rejects.

A host may execute the command immediately or arrange queued processing. FIFO queue setup,
acceptance acknowledgements, and transport retries belong to adapters. Queue acceptance is
not proof that the business command succeeded.

## Check a Balance

A query reads card state without modifying it. If a missing card returns `null`, its result
schema must permit that value:

```ts
const BalanceResult = z.object({
  cardId: z.string(),
  remainingValue: z.number().int().nonnegative(),
  currency: z.string()
}).nullable()
```

The final query definition and execution API remain open. A balance query cannot replace the
concurrency-protected balance check in the redemption command.

## Record a Redemption in Ledger

Ledger consumes the public `CardRedeemed` definition without importing GiftCards repositories
or commands. Its event handler translates the fact into a local operation:

```ts
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

Event identity survives local symbol renames. Cross-app package distribution and versioning
remain open. The adapter
configures publishers and queues. Ledger records business uniqueness by transaction identity
rather than generating a new business identity on every delivery.

## Compose the Context for a Host

```ts
export const giftCards = defineDomain('giftCards', {
  aggregates: { GiftCard },
  commands: { redeem: redeemCard },
  events: { CardRedeemed }
})

export const commerce = defineContext('commerce', {
  domains: { giftCards, checkout }
})
```

NestJS or another host uses this definition to configure execution and controllers. The context
does not start. There is no agreed binding or dependency-injection API yet.

Checkout directly invoking a GiftCards write is considered a code smell. Each write command
keeps its own transaction. If the nested redemption commits and Checkout later fails, the
redemption remains committed. Longer external workflows can use explicit business states
and queued processing rather than assuming a distributed rollback.
