import { randomUUID } from 'node:crypto'

import type { EventDefinition, Transaction } from '@atomly/dominion-core'

import { currentScope } from './scope.js'
import type { Logger, ProviderToken } from './scope.js'

export function raise<TInput, TData>(event: EventDefinition<TInput, TData>, input: TInput): void {
  currentScope().pendingEvents.push({ event, input: structuredClone(input), id: randomUUID() })
}

export function useTransaction(): Transaction {
  return currentScope().transaction
}

export function useLogger(): Logger {
  return currentScope().logger
}

export function createProviderToken<T>(name: string): ProviderToken<T> {
  if (!name.trim()) throw new Error('Provider token name must not be empty')
  return Object.freeze({ key: Symbol(name), name })
}

export function useProvider<T>(token: ProviderToken<T>): T {
  const providers = currentScope().providers
  if (!providers.has(token.key)) throw new Error(`Missing Dominion provider: ${token.name}`)
  // The host registers each value under its typed token; the map erases only that association.
  return providers.get(token.key) as T
}
