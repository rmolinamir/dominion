export type DomainError = {
  readonly code: string
  readonly message?: string
  readonly details?: unknown
}

export type Rejection = {
  readonly kind: 'rejection'
  readonly error: DomainError
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError }

export function reject(error: DomainError): Rejection {
  return Object.freeze({ kind: 'rejection', error: Object.freeze({ ...error }) })
}

export function isRejection(value: unknown): value is Rejection {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false
  if (value.kind !== 'rejection' || !('error' in value)) return false
  const error = value.error
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    (!('message' in error) || typeof error.message === 'string')
  )
}
