import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { AggregateDefinition } from './entities.js'
import { checkName } from './name.js'
import type { Rejection } from './result.js'

export interface CommandDefinition<TInput, TParsed, TState, TOutput> {
  readonly kind: 'command'
  readonly name: string
  readonly input: StandardSchemaV1<TInput, TParsed>
  readonly aggregate: AggregateDefinition<TState>
  readonly target: (input: TParsed) => string
  readonly handle: (
    input: TParsed,
    state: TState,
  ) => TOutput | Rejection | Promise<TOutput | Rejection>
}

export interface CommandBuilder {
  input<TInput, TParsed>(
    schema: StandardSchemaV1<TInput, TParsed>,
  ): CommandAggregateBuilder<TInput, TParsed>
}

export interface CommandAggregateBuilder<TInput, TParsed> {
  aggregate<TState>(
    definition: AggregateDefinition<TState>,
  ): CommandTargetBuilder<TInput, TParsed, TState>
}

export interface CommandTargetBuilder<TInput, TParsed, TState> {
  target(callback: (input: TParsed) => string): CommandHandleBuilder<TInput, TParsed, TState>
}

export interface CommandHandleBuilder<TInput, TParsed, TState> {
  handle<TReturn>(
    callback: (input: TParsed, state: TState) => TReturn,
  ): CommandDefinition<TInput, TParsed, TState, Exclude<Awaited<TReturn>, Rejection>>
}

export function defineCommand(name: string): CommandBuilder {
  checkName(name)
  return Object.freeze({
    input<TInput, TParsed>(input: StandardSchemaV1<TInput, TParsed>) {
      return Object.freeze({
        aggregate<TState>(aggregate: AggregateDefinition<TState>) {
          return Object.freeze({
            target(target: (input: TParsed) => string) {
              return Object.freeze({
                handle<TReturn>(callback: (input: TParsed, state: TState) => TReturn) {
                  // Awaited distributes over promises and rejection unions. This assertion
                  // bridges that conditional type without changing the callback at runtime.
                  const handle = callback as CommandDefinition<
                    TInput,
                    TParsed,
                    TState,
                    Exclude<Awaited<TReturn>, Rejection>
                  >['handle']
                  return Object.freeze({
                    kind: 'command' as const,
                    name,
                    input,
                    aggregate,
                    target,
                    handle,
                  })
                },
              })
            },
          })
        },
      })
    },
  })
}
