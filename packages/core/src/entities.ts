import type { StandardSchemaV1 } from '@standard-schema/spec'

import { checkName } from './name.js'

export interface EntityDefinition<
  TState,
  TSchema extends StandardSchemaV1<unknown, TState> = StandardSchemaV1<unknown, TState>,
> {
  readonly kind: 'entity'
  readonly name: string
  readonly schema: TSchema
  readonly id: (state: TState) => string
}

/** Callback-free metadata permits child entities with different state shapes. */
export type EntityMetadata = Pick<EntityDefinition<unknown>, 'kind' | 'name' | 'schema'>
export type ChildEntities = Readonly<Record<string, EntityMetadata>>

export type Invariant<TState> = {
  readonly code: string
  readonly message: string
  readonly check: (state: TState) => boolean
}

export interface AggregateDefinition<TState> {
  readonly kind: 'aggregate'
  readonly name: string
  readonly schema: StandardSchemaV1<unknown, TState>
  readonly id: (state: TState) => string
  readonly childEntities: ChildEntities
  readonly invariants: readonly Invariant<TState>[]
}

export interface EntityBuilder {
  schema<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): EntityIdBuilder<StandardSchemaV1.InferOutput<TSchema>, TSchema>
}

export interface EntityIdBuilder<TState, TSchema extends StandardSchemaV1<unknown, TState>> {
  id(callback: (state: TState) => string): EntityDefinition<TState, TSchema>
}

export interface AggregateBuilder {
  schema<TSchema extends StandardSchemaV1>(
    schema: TSchema,
  ): AggregateIdBuilder<StandardSchemaV1.InferOutput<TSchema>, TSchema>
}

export interface AggregateIdBuilder<TState, TSchema extends StandardSchemaV1<unknown, TState>> {
  id(
    callback: (state: TState) => string,
  ): FluentAggregateDefinition<TState, Readonly<Record<never, never>>, TSchema>
}

export interface FluentAggregateDefinition<
  TState,
  TChildren extends ChildEntities = Readonly<Record<never, never>>,
  TSchema extends StandardSchemaV1<unknown, TState> = StandardSchemaV1<unknown, TState>,
> extends AggregateDefinition<TState> {
  readonly schema: TSchema
  readonly childEntities: TChildren
  children<const TNext extends ChildEntities>(
    definitions: TNext,
  ): FluentAggregateDefinition<TState, Readonly<TNext>, TSchema>
  invariant(rule: Invariant<TState>): FluentAggregateDefinition<TState, TChildren, TSchema>
}

export function defineEntity(name: string): EntityBuilder {
  checkName(name)
  return Object.freeze({
    schema<TSchema extends StandardSchemaV1>(schema: TSchema) {
      return Object.freeze({
        id(id: (state: StandardSchemaV1.InferOutput<TSchema>) => string) {
          return Object.freeze({ kind: 'entity' as const, name, schema, id })
        },
      })
    },
  })
}

function aggregateDefinition<
  TState,
  TChildren extends ChildEntities,
  TSchema extends StandardSchemaV1<unknown, TState>,
>(
  name: string,
  schema: TSchema,
  id: (state: TState) => string,
  childEntities: TChildren,
  invariants: readonly Invariant<TState>[],
): FluentAggregateDefinition<TState, TChildren, TSchema> {
  return Object.freeze({
    kind: 'aggregate',
    name,
    schema,
    id,
    childEntities,
    invariants,
    children<const TNext extends ChildEntities>(definitions: TNext) {
      return aggregateDefinition(name, schema, id, Object.freeze({ ...definitions }), invariants)
    },
    invariant(rule: Invariant<TState>) {
      return aggregateDefinition(
        name,
        schema,
        id,
        childEntities,
        Object.freeze([...invariants, Object.freeze({ ...rule })]),
      )
    },
  })
}

export function defineAggregate(name: string): AggregateBuilder {
  checkName(name)
  return Object.freeze({
    schema<TSchema extends StandardSchemaV1>(schema: TSchema) {
      return Object.freeze({
        id(id: (state: StandardSchemaV1.InferOutput<TSchema>) => string) {
          return aggregateDefinition(name, schema, id, Object.freeze({}), Object.freeze([]))
        },
      })
    },
  })
}
