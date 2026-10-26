import type { AggregateDefinition } from './entities.js'
import { checkName } from './name.js'
import type { StandardSchemaV1 } from './schema.js'

/** Catalog constraints omit callbacks so concrete parameter types stay assignable. */
export type AggregateMetadata = Pick<AggregateDefinition<unknown>, 'kind' | 'name' | 'schema'>
export type CommandMetadata = {
  readonly kind: 'command'
  readonly name: string
  readonly input: StandardSchemaV1
  readonly aggregate: AggregateMetadata
}
export type EventMetadata = {
  readonly kind: 'event'
  readonly name: string
  readonly schema: StandardSchemaV1
}
export type EventHandlerMetadata = {
  readonly kind: 'eventHandler'
  readonly name: string
  readonly event: EventMetadata
}

export type DomainMembers = {
  readonly aggregates?: Readonly<Record<string, AggregateMetadata>>
  readonly commands?: Readonly<Record<string, CommandMetadata>>
  readonly events?: Readonly<Record<string, EventMetadata>>
  readonly eventHandlers?: Readonly<Record<string, EventHandlerMetadata>>
}

type ReadonlyMembers<T> = { readonly [K in keyof T]: Readonly<T[K]> }

export type DomainDefinition<TMembers extends DomainMembers = DomainMembers> = {
  readonly kind: 'domain'
  readonly name: string
} & ReadonlyMembers<TMembers>

export type ContextMembers = {
  readonly domains: Readonly<Record<string, DomainDefinition>>
}

export type ContextDefinition<TMembers extends ContextMembers = ContextMembers> = {
  readonly kind: 'context'
  readonly name: string
  readonly domains: Readonly<TMembers['domains']>
}

export function defineDomain<const TMembers extends DomainMembers>(
  name: string,
  members: TMembers,
): DomainDefinition<TMembers> {
  checkName(name)
  // Snapshot only catalog maps. Schemas and callback objects remain owned by their libraries.
  const maps = Object.fromEntries(
    Object.entries(members).map(([key, definitions]) => [key, Object.freeze({ ...definitions })]),
  ) as ReadonlyMembers<TMembers>
  return Object.freeze({ ...maps, kind: 'domain' as const, name }) as DomainDefinition<TMembers>
}

export function defineContext<const TMembers extends ContextMembers>(
  name: string,
  members: TMembers,
): ContextDefinition<TMembers> {
  checkName(name)
  return Object.freeze({
    kind: 'context',
    name,
    domains: Object.freeze({ ...members.domains }),
  })
}
