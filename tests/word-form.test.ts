import { describe, expect, it } from 'vitest'
import { importRowSchema } from '@shared/schemas'

// The admin edit form validates with the same schema as the import.
describe('word form validation (importRowSchema)', () => {
  const base = { article: 'das', lemma: 'Haus', translation: 'house', level: 'A1' }

  it('trims whitespace', () => {
    const r = importRowSchema.parse({ ...base, lemma: '  Haus ', translation: ' house  ' })
    expect(r).toMatchObject({ lemma: 'Haus', translation: 'house' })
  })
  it('turns empty optional fields into undefined so they clear the stored value', () => {
    const r = importRowSchema.parse({ ...base, plural: '', example: '   ' })
    expect(r.plural).toBeUndefined()
    expect(r.example).toBeUndefined()
  })
  it('keeps filled optional fields', () => {
    expect(importRowSchema.parse({ ...base, plural: 'Häuser' }).plural).toBe('Häuser')
  })
  it.each([
    ['empty word', { lemma: '  ' }],
    ['empty meaning', { translation: '' }],
    ['unknown article', { article: 'dax' }],
    ['unknown level', { level: 'C2' }],
    ['over-long word', { lemma: 'x'.repeat(101) }],
  ])('rejects %s', (_label, patch) => {
    expect(importRowSchema.safeParse({ ...base, ...patch }).success).toBe(false)
  })
})
