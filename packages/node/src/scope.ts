import { AsyncLocalStorage } from 'node:async_hooks'

import type { EventDefinition, Transaction } from '@atomly/dominion-core'

export interface Logger {
  info(message: string, fields?: Readonly<Record<string, unknown>>): void
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void
  error(message: string, fields?: Readonly<Record<string, unknown>>): void
}

export type ProviderToken<T> = {
  readonly key: symbol
  readonly name: string
  readonly type?: T
}

export type ProviderBinding<T> = {
  readonly token: ProviderToken<T>
  readonly value: T
}

export type PendingEvent = {
  readonly event: EventDefinition<unknown, unknown>
  readonly input: unknown
  readonly id: string
}

export type ExecutionScope = {
  readonly transaction: Transaction
  readonly logger: Logger
  readonly providers: ReadonlyMap<symbol, unknown>
  readonly pendingEvents: PendingEvent[]
  active: boolean
}

export const executionStorage: AsyncLocalStorage<ExecutionScope> = new AsyncLocalStorage()

export class ExecutionScopeError extends Error {
  constructor(message = 'No active Dominion command execution') {
    super(message)
    this.name = 'ExecutionScopeError'
  }
}

export function currentScope(): ExecutionScope {
  const scope = executionStorage.getStore()
  if (!scope?.active) throw new ExecutionScopeError()
  return scope
}

export const silentLogger: Logger = Object.freeze({
  info() {},
  warn() {},
  error() {},
})
