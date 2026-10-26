import { defineAggregate, defineCommand, defineEvent, reject } from '@atomly/dominion-core'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  createProviderToken,
  execute,
  ExecutionScopeError,
  raise,
  useLogger,
  useProvider,
  useTransaction,
} from '../src/index.js'
import { createMemoryStore } from '../src/testing.js'

const Card = defineAggregate('giftCards.GiftCard')
  .schema(z.object({ id: z.string(), balance: z.number().nonnegative() }))
  .id((state) => state.id)

const Redeemed = defineEvent('giftCards.CardRedeemed').schema(
  z.object({ cardId: z.string(), amount: z.number().positive() }),
)

const redeem = defineCommand('RedeemCard')
  .input(z.object({ cardId: z.string(), amount: z.number().positive() }))
  .aggregate(Card)
  .target((input) => input.cardId)
  .handle((input, card) => {
    if (input.amount > card.balance) return reject({ code: 'INSUFFICIENT_BALANCE' })
    card.balance -= input.amount
    raise(Redeemed, { cardId: card.id, amount: input.amount })
    return { balance: card.balance }
  })

function seededStore(): ReturnType<typeof createMemoryStore> {
  const memory = createMemoryStore()
  memory.seed(Card, { id: 'card', balance: 100 })
  return memory
}

describe('command execution', () => {
  it('commits state and returns validated events only after successful execution', async () => {
    const memory = seededStore()
    const result = await execute(redeem, { cardId: 'card', amount: 80 }, memory)
    expect(result).toMatchObject({
      ok: true,
      value: { balance: 20 },
      events: [{ type: 'giftCards.CardRedeemed', data: { cardId: 'card', amount: 80 } }],
    })
    expect(memory.inspect(Card, 'card')).toEqual({
      state: { id: 'card', balance: 20 },
      revision: 1,
    })
  })

  it('rejects invalid input before opening a transaction', async () => {
    let opened = false
    const result = await execute(
      redeem,
      { cardId: 'card', amount: -1 },
      {
        transactions: {
          async run() {
            opened = true
            throw new Error('Must not open a transaction')
          },
        },
      },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    expect(opened).toBe(false)
  })

  it('returns a not-found result without creating an aggregate', async () => {
    const result = await execute(redeem, { cardId: 'missing', amount: 10 }, createMemoryStore())
    expect(result).toMatchObject({ ok: false, error: { code: 'AGGREGATE_NOT_FOUND' } })
  })

  it('discards mutated state and events on business rejection', async () => {
    const memory = seededStore()
    const rejected = defineCommand('Rejected')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle((_id, card) => {
        card.balance = 0
        raise(Redeemed, { cardId: card.id, amount: 100 })
        return reject({ code: 'DECLINED' })
      })
    expect(await execute(rejected, 'card', memory)).toEqual({
      ok: false,
      error: { code: 'DECLINED' },
    })
    expect(memory.inspect(Card, 'card')?.state.balance).toBe(100)
    expect(memory.inspect(Card, 'card')?.revision).toBe(0)
  })

  it('rolls back on schema failure and invalid raised-event payloads', async () => {
    const memory = seededStore()
    const invalidState = defineCommand('InvalidState')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle((_id, card) => {
        card.balance = -10
      })
    expect(await execute(invalidState, 'card', memory)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    })
    const invalidEvent = defineCommand('InvalidEvent')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle((_id, card) => {
        card.balance = 0
        raise(Redeemed, { cardId: card.id, amount: 0 })
      })
    expect(await execute(invalidEvent, 'card', memory)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    })
    expect(memory.inspect(Card, 'card')?.state.balance).toBe(100)
  })

  it('checks mandatory invariants before persisting', async () => {
    const LimitedCard = Card.invariant({
      code: 'RESERVE_REQUIRED',
      message: 'Keep at least 10 in reserve',
      check: (card) => card.balance >= 10,
    })
    const spend = defineCommand('Spend')
      .input(z.string())
      .aggregate(LimitedCard)
      .target((id) => id)
      .handle((_id, card) => {
        card.balance = 0
      })
    const memory = seededStore()
    expect(await execute(spend, 'card', memory)).toMatchObject({
      ok: false,
      error: { code: 'RESERVE_REQUIRED' },
    })
    expect(memory.inspect(Card, 'card')?.state.balance).toBe(100)
  })

  it('prevents aggregate identity changes', async () => {
    const memory = seededStore()
    const rename = defineCommand('Rename')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle((_id, card) => {
        card.id = 'another'
      })
    expect(await execute(rename, 'card', memory)).toMatchObject({
      ok: false,
      error: { code: 'AGGREGATE_ID_CHANGED' },
    })
    expect(memory.inspect(Card, 'card')?.state.id).toBe('card')
  })

  it('allows only one concurrent write against a loaded revision', async () => {
    const memory = seededStore()
    let arrivals = 0
    let release = (): void => {}
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    const concurrent = defineCommand('ConcurrentRedemption')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle(async (_id, card) => {
        arrivals += 1
        if (arrivals === 2) release()
        await barrier
        card.balance -= 80
        raise(Redeemed, { cardId: card.id, amount: 80 })
      })
    const results = await Promise.all([
      execute(concurrent, 'card', memory),
      execute(concurrent, 'card', memory),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: 'CONCURRENT_MODIFICATION' }),
      }),
    ])
    expect(memory.inspect(Card, 'card')?.state.balance).toBe(20)
  })

  it('keeps a nested commit when its caller rejects and restores the caller scope', async () => {
    const memory = seededStore()
    const outer = defineCommand('Outer')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle(async (id, card) => {
        const transaction = useTransaction()
        expect(await execute(redeem, { cardId: id, amount: 20 }, memory)).toMatchObject({
          ok: true,
        })
        expect(useTransaction()).toBe(transaction)
        card.balance = 0
        return reject({ code: 'OUTER_REJECTED' })
      })
    expect(await execute(outer, 'card', memory)).toEqual({
      ok: false,
      error: { code: 'OUTER_REJECTED' },
    })
    expect(memory.inspect(Card, 'card')).toEqual({
      state: { id: 'card', balance: 80 },
      revision: 1,
    })
    expect(() => useTransaction()).toThrow(ExecutionScopeError)
  })

  it('rolls back programmer errors without hiding the original exception', async () => {
    const memory = seededStore()
    const cause = new Error('bug')
    const broken = defineCommand('Broken')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle((_id, card) => {
        card.balance = 0
        throw cause
      })
    await expect(execute(broken, 'card', memory)).rejects.toBe(cause)
    expect(memory.inspect(Card, 'card')?.state.balance).toBe(100)
  })

  it('resolves typed providers and prevents hooks outside execution', async () => {
    const token = createProviderToken<{ label: string }>('policy')
    const memory = seededStore()
    const inspect = defineCommand('Inspect')
      .input(z.string())
      .aggregate(Card)
      .target((id) => id)
      .handle(() => {
        useLogger().info('Policy resolved')
        return useProvider(token).label
      })
    expect(
      await execute(inspect, 'card', {
        transactions: memory.transactions,
        providers: [{ token, value: { label: 'test' } }],
      }),
    ).toMatchObject({ ok: true, value: 'test' })
    expect(() => useProvider(token)).toThrow(ExecutionScopeError)
    expect(() => raise(Redeemed, { cardId: 'card', amount: 1 })).toThrow(ExecutionScopeError)
  })
})
