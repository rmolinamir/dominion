import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'

import { isRejection, reject } from '../src/result.js'
import { validate } from '../src/schema.js'
import type { StandardSchemaV1 } from '../src/schema.js'

describe('schema validation', () => {
  it('returns transformed output rather than the transport input', async () => {
    const schema = z.string().transform((value) => ({ amount: Number(value) }))
    const result = await validate(schema, '42')
    expect(result).toEqual({ ok: true, value: { amount: 42 } })
    if (result.ok) expectTypeOf(result.value).toEqualTypeOf<{ amount: number }>()
  })

  it('returns structured issues including the original field path', async () => {
    const result = await validate(z.object({ amount: z.number().positive() }), { amount: -1 })
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        details: { issues: [{ path: ['amount'] }] },
      },
    })
  })

  it('supports asynchronous schemas and validation failures', async () => {
    const schema = z.string().refine(async (value) => value === 'valid', 'Unknown value')
    await expect(validate(schema, 'valid')).resolves.toEqual({ ok: true, value: 'valid' })
    await expect(validate(schema, 'invalid')).resolves.toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    })
  })

  it('preserves schema exceptions for both synchronous and asynchronous validators', async () => {
    const failure = new Error('Schema bug')
    const sync: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => {
          throw failure
        },
      },
    }
    const asyncSchema: StandardSchemaV1 = {
      '~standard': { version: 1, vendor: 'test', validate: () => Promise.reject(failure) },
    }
    await expect(validate(sync, 'input')).rejects.toBe(failure)
    await expect(validate(asyncSchema, 'input')).rejects.toBe(failure)
  })
})

describe('rejections', () => {
  it('preserves structured business failures without throwing', () => {
    const details = { remaining: 10 }
    const error = { code: 'INSUFFICIENT_BALANCE', message: 'Balance too low', details }
    const rejection = reject(error)
    error.code = 'CHANGED'
    expect(rejection).toEqual({
      kind: 'rejection',
      error: { code: 'INSUFFICIENT_BALANCE', message: 'Balance too low', details },
    })
    expect(isRejection(rejection)).toBe(true)
    expect(Object.isFrozen(rejection)).toBe(true)
    expect(Object.isFrozen(rejection.error)).toBe(true)
  })

  it.each([
    null,
    undefined,
    'rejection',
    {},
    { kind: 'event' },
    { kind: 'rejection' },
    { kind: 'rejection', error: null },
    { kind: 'rejection', error: { code: 1 } },
    { kind: 'rejection', error: { code: 'INVALID', message: 1 } },
  ])('does not mistake malformed data for a rejection: %j', (value) => {
    expect(isRejection(value)).toBe(false)
  })
})
