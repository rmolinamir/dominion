import type { StandardSchemaV1 } from '@standard-schema/spec'

import { checkName } from './name.js'

export interface EventDefinition<TInput, TData> {
  readonly kind: 'event'
  readonly name: string
  readonly schema: StandardSchemaV1<TInput, TData>
}

export interface EventBuilder {
  schema<TInput, TData>(schema: StandardSchemaV1<TInput, TData>): EventDefinition<TInput, TData>
}

export function defineEvent(name: string): EventBuilder {
  checkName(name)
  return Object.freeze({
    schema<TInput, TData>(schema: StandardSchemaV1<TInput, TData>) {
      return Object.freeze({ kind: 'event' as const, name, schema })
    },
  })
}

export interface EventHandlerDefinition<TInput, TData, TOutput> {
  readonly kind: 'eventHandler'
  readonly name: string
  readonly event: EventDefinition<TInput, TData>
  readonly handle: (event: TData) => TOutput | Promise<TOutput>
}

export interface EventHandlerBuilder {
  on<TInput, TData>(event: EventDefinition<TInput, TData>): EventHandlerHandleBuilder<TInput, TData>
}

export interface EventHandlerHandleBuilder<TInput, TData> {
  handle<TOutput>(
    callback: (event: TData) => TOutput | Promise<TOutput>,
  ): EventHandlerDefinition<TInput, TData, TOutput>
}

export function defineEventHandler(name: string): EventHandlerBuilder {
  checkName(name)
  return Object.freeze({
    on<TInput, TData>(event: EventDefinition<TInput, TData>) {
      return Object.freeze({
        handle<TOutput>(callback: (data: TData) => TOutput | Promise<TOutput>) {
          return Object.freeze({ kind: 'eventHandler' as const, name, event, handle: callback })
        },
      })
    },
  })
}
