export type AggregateKey = {
  readonly name: string
  readonly id: string
}

export type StoredAggregate<TState> = {
  readonly state: TState
  readonly revision: number
}

export type SaveOutcome =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly code: 'CONCURRENT_MODIFICATION' }

/** Adapters deserialize state. Execution validates loaded state against its aggregate schema. */
export interface AggregateStore {
  load<TState>(key: AggregateKey): Promise<StoredAggregate<TState> | undefined>
  save<TState>(key: AggregateKey, state: TState, expectedRevision: number): Promise<SaveOutcome>
}

export interface Transaction {
  readonly store: AggregateStore
}

/** Commit only when work resolves. Roll back when work throws or rejects. */
export interface TransactionRunner {
  run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>
}
