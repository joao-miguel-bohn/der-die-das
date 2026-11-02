import { describe, expect, it } from 'vitest'
import { countSameMeaning, meanings, sharesMeaning } from '@shared/meanings'

describe('meanings', () => {
  it('splits on ; , and / and normalises each meaning', () => {
    expect(meanings('woman; wife; Mrs.')).toEqual(['woman', 'wife', 'mrs.'])
    expect(meanings('The car, automobile / (motor) vehicle')).toEqual(['car', 'automobile', 'vehicle'])
    expect(meanings('to  work (job)')).toEqual(['work'])
  })
})

describe('sharesMeaning', () => {
  it('matches any meaning in common, ignoring case', () => {
    expect(sharesMeaning('wife', 'woman; wife; Mrs.')).toBe(true)
    expect(sharesMeaning('Wife', 'housewife')).toBe(false)
  })
})

describe('countSameMeaning', () => {
  it('counts the other words that share a meaning, each once', () => {
    const all = [
      { id: 1, translation: 'wife' },
      { id: 2, translation: 'woman; wife; Mrs.' },
      { id: 3, translation: 'housewife' },
      { id: 4, translation: 'car' },
      { id: 5, translation: 'car; wagon' },
      { id: 6, translation: 'car, automobile' },
    ]
    const counts = countSameMeaning([all[0]!, all[2]!, all[3]!], all)
    expect(Object.fromEntries(counts)).toEqual({ 1: 1, 3: 0, 4: 2 })
  })
})
