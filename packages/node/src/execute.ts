import { isRejection, validate } from '@atomly/dominion-core'
import type { CommandDefinition, DomainError, TransactionRunner } from '@atomly/dominion-core'

import { ConcurrentModificationError } from './errors.js'
import { currentScope, executionStorage, silentLogger } from './scope.js'
import type { ExecutionScope, Logger, ProviderBinding } from './scope.js'

export type RaisedEvent = {
  readonly id: string
  readonly type: string
  readonly data: unknown
}

export type ExecutionResult<T> =
  | { readonly ok: true; readonly value: T; readonly events: readonly RaisedEvent[] }
  | { readonly ok: false; readonly error: DomainError }

export type ExecutionOptions = {
  readonly transactions: TransactionRunner
  readonly logger?: Logger
  readonly providers?: readonly ProviderBinding<unknown>[]
}

class AbortedExecution extends Error {
  readonly error: DomainError

  constructor(error: DomainError) {
    super(error.message ?? error.code)
    this.error = error
  }
}

/** Execute one aggregate command. Even a nested invocation gets a fresh transaction. */
export async function execute<TInput, TParsed, TState, TOutput>(
  command: CommandDefinition<TInput, TParsed, TState, TOutput>,
  input: TInput,
  options: ExecutionOptions,
): Promise<ExecutionResult<TOutput>> {
  const parsed = await validate(command.input, input)
  if (!parsed.ok) return parsed

  const id = command.target(parsed.value)
  const key = { name: command.aggregate.name, id }
  const caller = executionStorage.getStore()
  const providers = new Map(caller?.providers)
  for (const binding of options.providers ?? []) {
    providers.set(binding.token.key, binding.value)
  }

  try {
    return await options.transactions.run(async (transaction) => {
      const scope: ExecutionScope = {
        transaction,
        logger: options.logger ?? caller?.logger ?? silentLogger,
        providers,
        pendingEvents: [],
        active: true,
      }
      return executionStorage.run(scope, async () => {
        try {
          const stored = await transaction.store.load<TState>(key)
          if (!stored) throw new AbortedExecution({ code: 'AGGREGATE_NOT_FOUND', details: key })

          const loaded = await validate(command.aggregate.schema, structuredClone(stored.state))
          if (!loaded.ok) throw new AbortedExecution(loaded.error)
          const state = loaded.value
          const output = await command.handle(parsed.value, state)
          if (isRejection(output)) throw new AbortedExecution(output.error)

          const checked = await validate(command.aggregate.schema, state)
          if (!checked.ok) throw new AbortedExecution(checked.error)
          if (command.aggregate.id(checked.value) !== id) {
            throw new AbortedExecution({ code: 'AGGREGATE_ID_CHANGED', details: key })
          }
          for (const invariant of command.aggregate.invariants) {
            if (!invariant.check(checked.value)) {
              throw new AbortedExecution({ code: invariant.code, message: invariant.message })
            }
          }

          const events: RaisedEvent[] = []
          for (const pending of currentScope().pendingEvents) {
            const event = await validate(pending.event.schema, pending.input)
            if (!event.ok) throw new AbortedExecution(event.error)
            events.push(
              Object.freeze({ id: pending.id, type: pending.event.name, data: event.value }),
            )
          }

          const saved = await transaction.store.save(key, checked.value, stored.revision)
          if (!saved.ok) throw new ConcurrentModificationError(key)
          return { ok: true, value: output, events: Object.freeze(events) }
        } finally {
          scope.active = false
        }
      })
    })
  } catch (error) {
    if (error instanceof AbortedExecution) return { ok: false, error: error.error }
    if (error instanceof ConcurrentModificationError) {
      return { ok: false, error: { code: error.code, details: error.aggregate } }
    }
    // Programmer errors and adapter failures retain their original cause and stack.
    throw error
  }
}
