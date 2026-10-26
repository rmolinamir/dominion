import {
  defineAggregate,
  defineCommand,
  defineContext,
  defineDomain,
  defineEvent,
  reject,
} from '@atomly/dominion-core'
import { execute, raise } from '@atomly/dominion-node'
import { createMemoryStore } from '@atomly/dominion-node/testing'
import { z } from 'zod'

const GiftCard = defineAggregate('giftCards.GiftCard')
  .schema(z.object({ id: z.string(), balance: z.number().int().nonnegative() }))
  .id((card) => card.id)

const CardRedeemed = defineEvent('giftCards.CardRedeemed').schema(
  z.object({ cardId: z.string(), amountMinor: z.number().int().positive() }),
)

const redeemCard = defineCommand('RedeemCard')
  .input(z.object({ cardId: z.string(), amountMinor: z.number().int().positive() }))
  .aggregate(GiftCard)
  .target((input) => input.cardId)
  .handle((input, card) => {
    if (input.amountMinor > card.balance) return reject({ code: 'INSUFFICIENT_BALANCE' })
    card.balance -= input.amountMinor
    raise(CardRedeemed, { cardId: card.id, amountMinor: input.amountMinor })
    return { balance: card.balance }
  })

const giftCards = defineDomain('giftCards', {
  aggregates: { GiftCard },
  commands: { redeem: redeemCard },
  events: { CardRedeemed },
})

const commerce = defineContext('commerce', { domains: { giftCards } })
const memory = createMemoryStore()
memory.seed(GiftCard, { id: 'card-123', balance: 100 })

const result = await execute(
  commerce.domains.giftCards.commands.redeem,
  { cardId: 'card-123', amountMinor: 80 },
  { transactions: memory.transactions },
)

console.log(JSON.stringify(result, null, 2))
