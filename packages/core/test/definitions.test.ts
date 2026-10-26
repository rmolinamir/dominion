import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  defineAggregate,
  defineCommand,
  defineContext,
  defineDomain,
  defineEntity,
  defineEvent,
  defineEventHandler,
  reject,
} from '../src/index.js'

const Line = defineEntity('OrderLine')
  .schema(z.object({ id: z.string(), quantity: z.number().positive() }))
  .id((line) => line.id)

const Order = defineAggregate('Order')
  .schema(z.object({ id: z.string(), lines: z.array(Line.schema), total: z.number() }))
  .id((order) => order.id)

describe('aggregate definitions', () => {
  it('retains root and child identity and snapshots child maps', () => {
    const children = { lines: Line }
    const withChildren = Order.children(children)
    const Other = defineEntity('Other')
      .schema(Line.schema)
      .id((value) => value.id)
    children.lines = Other

    expect(withChildren.childEntities.lines).toBe(Line)
    expect(withChildren.childEntities.lines.id({ id: 'line-1', quantity: 2 })).toBe('line-1')
    expect(withChildren.id({ id: 'order-1', lines: [], total: 0 })).toBe('order-1')
    expect(Order.childEntities).toEqual({})
    expect(Object.isFrozen(withChildren)).toBe(true)
    expect(Object.isFrozen(withChildren.childEntities)).toBe(true)
  })

  it('appends invariants without mutating earlier definitions or caller rules', () => {
    const rule = {
      code: 'NEGATIVE_TOTAL',
      message: 'Total must be nonnegative',
      check: (state: { total: number }) => state.total >= 0,
    }
    const checked = Order.children({ lines: Line }).invariant(rule)
    rule.code = 'CHANGED'
    const checkedTwice = checked.invariant({
      code: 'HAS_LINES',
      message: 'Order must have lines',
      check: (state) => state.lines.length > 0,
    })
    expect(Order.invariants).toEqual([])
    expect(checked.invariants).toHaveLength(1)
    expect(checked.invariants[0]?.code).toBe('NEGATIVE_TOTAL')
    expect(checked.invariants[0]?.check({ id: 'o', lines: [], total: -1 })).toBe(false)
    expect(checkedTwice.invariants).toHaveLength(2)
    expect(checkedTwice.childEntities.lines).toBe(Line)
    expect(Object.isFrozen(checked.invariants)).toBe(true)
    expect(Object.isFrozen(checked.invariants[0])).toBe(true)
  })

  it('replaces child maps on a fresh definition and retains existing invariants', () => {
    const checked = Order.invariant({ code: 'VALID', message: 'Valid', check: () => true })
    const first = checked.children({ lines: Line })
    const second = first.children({ items: Line })
    expect(Object.keys(first.childEntities)).toEqual(['lines'])
    expect(Object.keys(second.childEntities)).toEqual(['items'])
    expect(second.invariants).toBe(first.invariants)
  })
})

describe('command and event definitions', () => {
  it('uses transformed inputs with full aggregate state and preserves handler identity', async () => {
    const input = z.object({ id: z.string(), amount: z.string().transform(Number) })
    const command = defineCommand('orders.Discount')
      .input(input)
      .aggregate(Order)
      .target((data) => data.id)
      .handle((data, state) => {
        if (data.amount > state.total) return reject({ code: 'EXCESSIVE_DISCOUNT' })
        state.total -= data.amount
        return state.total
      })
    const state = { id: 'order-1', lines: [], total: 20 }
    expect(command.target({ id: 'order-1', amount: 5 })).toBe('order-1')
    expect(await command.handle({ id: 'order-1', amount: 5 }, state)).toBe(15)
    expect(await command.handle({ id: 'order-1', amount: 50 }, state)).toEqual(
      reject({ code: 'EXCESSIVE_DISCOUNT' }),
    )
    expect(command.aggregate).toBe(Order)
    expect(command.input).toBe(input)
    expect(Object.isFrozen(command)).toBe(true)
  })

  it('records a reaction to event output without changing its wire name', async () => {
    const event = defineEvent('giftCards.CardRedeemed').schema(z.string().transform(Number))
    const handler = defineEventHandler('RecordRedemption')
      .on(event)
      .handle(async (data) => data + 1)
    expect(await handler.handle(2)).toBe(3)
    expect(handler.event).toBe(event)
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(handler)).toBe(true)
    defineDomain('renamedLocalDomain', { events: { renamedExport: event } })
    expect(event.name).toBe('giftCards.CardRedeemed')
  })
})

describe('passive composition', () => {
  it('snapshots maps, preserves exact definitions and allows reuse across contexts', () => {
    const event = defineEvent('OrderSubmitted').schema(z.object({ id: z.string() }))
    const events = { submitted: event }
    const domain = defineDomain('orders', { aggregates: { Order }, events })
    events.submitted = defineEvent('Replacement').schema(event.schema)
    const domains = { orders: domain }
    const context = defineContext('commerce', { domains })
    domains.orders = defineDomain('replacement', { aggregates: { Order }, events })
    expect(context.domains.orders).toBe(domain)
    expect(domain.events.submitted).toBe(event)
    expect(domain.aggregates.Order).toBe(Order)
    expect(defineContext('other', { domains: { orders: domain } }).domains.orders).toBe(domain)
    expect(Object.isFrozen(domain)).toBe(true)
    expect(Object.isFrozen(domain.events)).toBe(true)
    expect(Object.isFrozen(context)).toBe(true)
    expect(Object.isFrozen(context.domains)).toBe(true)
    expect(defineDomain('empty', {})).toEqual({ kind: 'domain', name: 'empty' })
  })

  it.each(['', ' ', '\n\t'])('rejects empty names at each entry point: %j', (name) => {
    for (const define of [
      defineEntity,
      defineAggregate,
      defineCommand,
      defineEvent,
      defineEventHandler,
    ]) {
      expect(() => define(name)).toThrow(TypeError)
    }
    expect(() => defineDomain(name, {})).toThrow(TypeError)
    expect(() => defineContext(name, { domains: {} })).toThrow(TypeError)
  })
})
