import { describe, expect, it } from 'vitest'
import { checkPick, checkTyped, parseTyped } from '@shared/answer'

const haus = { article: 'das', lemma: 'Haus' } as const
const maedchen = { article: 'das', lemma: 'Mädchen' } as const
const strasse = { article: 'die', lemma: 'Straße' } as const

describe('parseTyped', () => {
  it('splits article and lemma, ignoring case and extra spaces', () => {
    expect(parseTyped('  Das   Haus ')).toEqual({ article: 'das', lemma: 'Haus' })
  })
  it('returns null article when none typed', () => {
    expect(parseTyped('Haus')).toEqual({ article: null, lemma: 'Haus' })
  })
  it('keeps multi-word lemmas', () => {
    expect(parseTyped('die erste Hilfe')).toEqual({ article: 'die', lemma: 'erste Hilfe' })
  })
})

describe('checkTyped', () => {
  it('accepts a correct answer', () => {
    expect(checkTyped('das Haus', haus).correct).toBe(true)
  })
  it('separates wrong article from correct spelling', () => {
    const r = checkTyped('der Haus', haus)
    expect(r).toMatchObject({ articleOk: false, lemmaOk: true, correct: false })
  })
  it('separates wrong spelling from correct article', () => {
    const r = checkTyped('das Hous', haus)
    expect(r).toMatchObject({ articleOk: true, lemmaOk: false, correct: false })
  })
  it('flags capitalization-only mistakes', () => {
    const r = checkTyped('das haus', haus)
    expect(r).toMatchObject({ lemmaOk: false, capitalizationOnly: true, correct: false })
  })
  it('accepts ae/oe/ue/ss alternatives', () => {
    expect(checkTyped('das Maedchen', maedchen).correct).toBe(true)
    expect(checkTyped('die Strasse', strasse).correct).toBe(true)
  })
  it('treats a missing article as wrong', () => {
    expect(checkTyped('Haus', haus)).toMatchObject({ articleOk: false, lemmaOk: true })
  })
})

describe('checkPick', () => {
  it('only tests the article', () => {
    expect(checkPick('das', haus).correct).toBe(true)
    expect(checkPick('der', haus)).toMatchObject({ articleOk: false, lemmaOk: true, correct: false })
  })
})
