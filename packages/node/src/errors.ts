import type { AggregateKey } from '@atomly/dominion-core'

export class ConcurrentModificationError extends Error {
  readonly code = 'CONCURRENT_MODIFICATION'
  readonly aggregate: AggregateKey

  constructor(aggregate: AggregateKey) {
    super(`Concurrent modification of ${aggregate.name}/${aggregate.id}`)
    this.name = 'ConcurrentModificationError'
    this.aggregate = aggregate
  }
}
