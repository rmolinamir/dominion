import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { Result } from './result.js'

export type { StandardSchemaV1 } from '@standard-schema/spec'

export type SchemaInput<TSchema extends StandardSchemaV1> = StandardSchemaV1.InferInput<TSchema>
export type SchemaOutput<TSchema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<TSchema>

export async function validate<TInput, TOutput>(
  schema: StandardSchemaV1<TInput, TOutput>,
  value: unknown,
): Promise<Result<TOutput>> {
  const result = await schema['~standard'].validate(value)
  if (result.issues) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Schema validation failed',
        details: { issues: result.issues },
      },
    }
  }
  return { ok: true, value: result.value }
}
