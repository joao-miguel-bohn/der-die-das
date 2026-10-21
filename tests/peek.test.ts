import { describe, expect, it } from 'vitest'
import { maskLemma } from '@shared/peek'

describe('maskLemma', () => {
  it('reveals the first letters and masks the rest', () => {
    expect(maskLemma('Schrank', 1)).toEqual({ masked: 'S______', shown: 1 })
    expect(maskLemma('Schrank', 3)).toEqual({ masked: 'Sch____', shown: 3 })
  })
  it('never reveals the last letter', () => {
    expect(maskLemma('Schrank', 50)).toEqual({ masked: 'Schran_', shown: 6 })
    expect(maskLemma('E', 1)).toEqual({ masked: '_', shown: 0 })
  })
  it('counts umlauts and ß as one letter', () => {
    expect(maskLemma('Übung', 1)).toEqual({ masked: 'Ü____', shown: 1 })
    expect(maskLemma('Straße', 5)).toEqual({ masked: 'Straß_', shown: 5 })
  })
  it('keeps spaces and hyphens visible', () => {
    expect(maskLemma('E-Mail', 1)).toEqual({ masked: 'E-____', shown: 1 })
  })
})
