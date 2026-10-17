import { describe, expect, it } from 'vitest'
import { parseCsv, parseImportFile, parseJson } from '@shared/import'

describe('parseCsv', () => {
  it('parses a standard file', () => {
    const { rows, errors } = parseCsv('article,word,translation,level\ndas,Haus,house,A1\nder,Apfel,apple,a1\n')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { article: 'das', lemma: 'Haus', translation: 'house', level: 'A1' },
      { article: 'der', lemma: 'Apfel', translation: 'apple', level: 'A1' },
    ])
  })
  it('splits "das Haus" when there is no article column', () => {
    const { rows, errors } = parseCsv('word;translation;level\ndas Haus;house;A1')
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ article: 'das', lemma: 'Haus' })
  })
  it('handles quoted fields with commas and optional columns', () => {
    const { rows } = parseCsv('article,word,translation,level,plural,example\ndas,Haus,"house, home",A1,Häuser,"Das Haus ist groß."')
    expect(rows[0]).toMatchObject({ translation: 'house, home', plural: 'Häuser', example: 'Das Haus ist groß.' })
  })
  it('reports row-level errors and duplicates without dropping valid rows', () => {
    const { rows, errors } = parseCsv('article,word,translation,level\ndas,Haus,house,A1\ndie,Haus,x,Z9\ndas,Haus,house,A1\nfoo,Tisch,table,A1')
    expect(rows).toHaveLength(1)
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4])
  })
  it('rejects a file without required headers', () => {
    expect(parseCsv('a,b\n1,2').errors[0]?.row).toBe(0)
  })
})

describe('parseJson / parseImportFile', () => {
  const json = JSON.stringify([{ article: 'die', word: 'Katze', translation: 'cat', level: 'A1' }])
  it('parses JSON arrays', () => {
    expect(parseJson(json).rows[0]).toMatchObject({ article: 'die', lemma: 'Katze' })
  })
  it('chooses the parser by extension', () => {
    expect(parseImportFile('words.json', json).rows).toHaveLength(1)
  })
  it('reports invalid JSON', () => {
    expect(parseJson('{oops').errors[0]?.message).toBe('invalid JSON')
  })
})
