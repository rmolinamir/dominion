import { expectTypeOf } from 'vitest'
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
import type {
  AggregateDefinition,
  CommandDefinition,
  EntityMetadata,
  SchemaInput,
  SchemaOutput,
} from '../src/index.js'

const lineSchema = z.object({ id: z.string(), quantity: z.number() })
const Line = defineEntity('OrderLine')
  .schema(lineSchema)
  .id((line) => line.id)
const Order = defineAggregate('Order')
  .schema(z.object({ id: z.string(), lines: z.array(Line.schema), total: z.number() }))
  .id((order) => order.id)
  .children({ lines: Line })
  .invariant({
    code: 'NONNEGATIVE_TOTAL',
    message: 'Total must be nonnegative',
    check: (order) => order.total >= 0 && order.lines.every((line) => line.quantity > 0),
  })

type OrderState = { id: string; lines: { id: string; quantity: number }[]; total: number }

const input = z.object({ id: z.string(), amount: z.string().transform(Number) })
const discount = defineCommand('orders.Discount')
  .input(input)
  .aggregate(Order)
  .target((data) => data.id)
  .handle(async (data, state) => {
    expectTypeOf(data.amount).toEqualTypeOf<number>()
    expectTypeOf(state).toEqualTypeOf<OrderState>()
    if (data.amount > state.total) return reject({ code: 'EXCESSIVE_DISCOUNT' })
    state.total -= data.amount
    return state.total
  })

const Discounted = defineEvent('orders.Discounted').schema(z.string().transform(Number))
const recordDiscount = defineEventHandler('RecordDiscount')
  .on(Discounted)
  .handle((data) => {
    expectTypeOf(data).toEqualTypeOf<number>()
    return String(data)
  })

const orders = defineDomain('orders', {
  aggregates: { Order },
  commands: { discount },
  events: { Discounted },
  eventHandlers: { recordDiscount },
})
const commerce = defineContext('commerce', { domains: { orders } })

expectTypeOf(Line.schema).toEqualTypeOf<typeof lineSchema>()
expectTypeOf(Order.childEntities.lines).toEqualTypeOf<typeof Line>()
expectTypeOf(Order).toExtend<AggregateDefinition<OrderState>>()
expectTypeOf(Line).toExtend<EntityMetadata>()
expectTypeOf<SchemaInput<typeof discount.input>>().toEqualTypeOf<{ id: string; amount: string }>()
expectTypeOf<SchemaOutput<typeof discount.input>>().toEqualTypeOf<{ id: string; amount: number }>()
expectTypeOf(discount).toEqualTypeOf<
  CommandDefinition<
    { id: string; amount: string },
    { id: string; amount: number },
    OrderState,
    number
  >
>()
expectTypeOf(commerce.domains.orders.commands.discount).toEqualTypeOf<typeof discount>()
expectTypeOf(commerce.domains.orders.aggregates.Order).toEqualTypeOf<typeof Order>()
expectTypeOf(orders.eventHandlers.recordDiscount).toEqualTypeOf<typeof recordDiscount>()

// Negative checks stay in a separate file so Vitest never executes invalid calls.
// @ts-expect-error Only explicitly composed command keys exist.
void orders.commands.missing
// @ts-expect-error Child identity uses its actual state type.
Order.childEntities.lines.id({ id: 'line' })
// @ts-expect-error Catalog maps are readonly.
orders.commands.discount = discount
// @ts-expect-error Context maps are readonly.
commerce.domains.orders = orders
// @ts-expect-error Child maps are readonly.
Order.childEntities.lines = Line
defineCommand('BadTarget')
  .input(input)
  .aggregate(Order)
  // @ts-expect-error A target receives parsed schema output, not raw transport input.
  .target((data) => data.amount.toUpperCase())
defineCommand('Stateless')
  .input(input)
  // @ts-expect-error A command must select an aggregate before selecting a target.
  .target((data: { id: string }) => data.id)
defineEventHandler('BadEventHandler')
  .on(Discounted)
  // @ts-expect-error Event handlers receive parsed output.
  .handle((data: string) => data)
// @ts-expect-error Commands require actual command metadata.
defineDomain('invalid', { commands: { event: Discounted } })
// @ts-expect-error Contexts require domains.
defineContext('invalid', { domains: { event: Discounted } })

const rejectsOnly = defineCommand('RejectOnly')
  .input(input)
  .aggregate(Order)
  .target((data) => data.id)
  .handle(() => reject({ code: 'DENIED' }))
expectTypeOf(rejectsOnly).toEqualTypeOf<
  CommandDefinition<
    { id: string; amount: string },
    { id: string; amount: number },
    OrderState,
    never
  >
>()
