import type {
  AggregateDefinition,
  AggregateKey,
  AggregateStore,
  SaveOutcome,
  StoredAggregate,
  Transaction,
  TransactionRunner,
} from '@atomly/dominion-core'

import { ConcurrentModificationError } from './errors.js'

export type MemoryStore = {
  readonly transactions: TransactionRunner
  seed<TState>(aggregate: AggregateDefinition<TState>, state: TState, revision?: number): void
  inspect<TState>(
    aggregate: AggregateDefinition<TState>,
    id: string,
  ): StoredAggregate<TState> | undefined
}

function keyOf(key: AggregateKey): string {
  return JSON.stringify([key.name, key.id])
}

/** Test adapter only: process-local atomic commits, no durable event delivery. */
export function createMemoryStore(): MemoryStore {
  const records = new Map<string, StoredAggregate<unknown>>()

  const transactions: TransactionRunner = {
    async run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
      let active = true
      const writes = new Map<
        string,
        { key: AggregateKey; state: unknown; expectedRevision: number }
      >()
      function assertActive(): void {
        if (!active) throw new Error('The Dominion transaction has already completed')
      }
      const store: AggregateStore = {
        async load<TState>(key: AggregateKey): Promise<StoredAggregate<TState> | undefined> {
          assertActive()
          const record = records.get(keyOf(key))
          // The runtime validates loaded state against the aggregate schema before use.
          return record ? (structuredClone(record) as StoredAggregate<TState>) : undefined
        },
        async save<TState>(
          key: AggregateKey,
          state: TState,
          expectedRevision: number,
        ): Promise<SaveOutcome> {
          assertActive()
          const identity = keyOf(key)
          if (writes.has(identity))
            throw new Error('An aggregate may only be saved once per transaction')
          const record = records.get(identity)
          if (record?.revision !== expectedRevision) {
            return { ok: false, code: 'CONCURRENT_MODIFICATION' }
          }
          writes.set(identity, { key, state: structuredClone(state), expectedRevision })
          return { ok: true, revision: expectedRevision + 1 }
        },
      }

      try {
        const value = await work({ store })
        // No await between checking revisions and applying writes: commit is atomic in this process.
        for (const [identity, pending] of writes) {
          if (records.get(identity)?.revision !== pending.expectedRevision) {
            throw new ConcurrentModificationError(pending.key)
          }
        }
        for (const [identity, pending] of writes) {
          records.set(identity, { state: pending.state, revision: pending.expectedRevision + 1 })
        }
        return value
      } finally {
        active = false
      }
    },
  }

  return {
    transactions,
    seed<TState>(aggregate: AggregateDefinition<TState>, state: TState, revision = 0): void {
      if (!Number.isSafeInteger(revision) || revision < 0)
        throw new Error('Invalid aggregate revision')
      const key = keyOf({ name: aggregate.name, id: aggregate.id(state) })
      if (records.has(key)) throw new Error(`Aggregate already seeded: ${key}`)
      records.set(key, { state: structuredClone(state), revision })
    },
    inspect<TState>(
      aggregate: AggregateDefinition<TState>,
      id: string,
    ): StoredAggregate<TState> | undefined {
      const record = records.get(keyOf({ name: aggregate.name, id }))
      return record ? (structuredClone(record) as StoredAggregate<TState>) : undefined
    },
  }
}
