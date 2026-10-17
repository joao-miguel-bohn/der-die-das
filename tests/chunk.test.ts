import { describe, expect, it } from 'vitest'
import { chunk } from '@shared/chunk'
import { deleteWordsSchema, resetProgressSchema } from '@shared/schemas'

describe('chunk', () => {
  it('splits into chunks of at most the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns no chunks for an empty list', () => {
    expect(chunk([], 3)).toEqual([])
  })
  it('rejects a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })
})

describe('deleteWordsSchema', () => {
  it('accepts a list of positive integer ids', () => {
    expect(deleteWordsSchema.safeParse({ ids: [1, 2, 3] }).success).toBe(true)
  })
  it.each([[[]], [[0]], [[-1]], [[1.5]], [['1']], [Array.from({ length: 501 }, (_, i) => i + 1)]])('rejects %j', (ids) => {
    expect(deleteWordsSchema.safeParse({ ids }).success).toBe(false)
  })
})

describe('resetProgressSchema', () => {
  it('accepts an explicit reset of everything', () => {
    expect(resetProgressSchema.safeParse({ scope: 'all' }).success).toBe(true)
  })
  it('accepts a reset of specific words', () => {
    expect(resetProgressSchema.safeParse({ scope: 'words', wordIds: [4, 5] }).success).toBe(true)
  })
  it('never treats an empty or ambiguous body as "reset everything"', () => {
    expect(resetProgressSchema.safeParse({}).success).toBe(false)
    expect(resetProgressSchema.safeParse({ scope: 'words' }).success).toBe(false)
    expect(resetProgressSchema.safeParse({ scope: 'words', wordIds: [] }).success).toBe(false)
    expect(resetProgressSchema.safeParse({ scope: 'everything' }).success).toBe(false)
  })
})
