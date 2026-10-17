import { describe, expect, it } from 'vitest'
import { computeStreak, DAY_MS, localDate } from '@shared/dates'
import { hintFor } from '@shared/hints'
import { nextState, statusForBox } from '@shared/srs'

const now = Date.UTC(2026, 9, 17, 12, 0, 0)

describe('nextState', () => {
  it('promotes a new word to box 1, due in 1 day, on a correct typed answer', () => {
    expect(nextState({ box: 0, dueAt: 0 }, true, 'type', now)).toEqual({ box: 1, dueAt: now + DAY_MS })
  })
  it('walks through the boxes with growing intervals', () => {
    expect(nextState({ box: 1, dueAt: 0 }, true, 'type', now)).toEqual({ box: 2, dueAt: now + 3 * DAY_MS })
    expect(nextState({ box: 4, dueAt: 0 }, true, 'type', now)).toEqual({ box: 5, dueAt: now + 30 * DAY_MS })
  })
  it('caps at box 5', () => {
    expect(nextState({ box: 5, dueAt: 0 }, true, 'type', now).box).toBe(5)
  })
  it('sends wrong answers back to box 1, due immediately, in any mode', () => {
    for (const mode of ['type', 'pick', 'sprint'] as const) {
      expect(nextState({ box: 4, dueAt: now + DAY_MS }, false, mode, now)).toEqual({ box: 1, dueAt: now })
    }
  })
  it('does not promote on correct pick/sprint answers', () => {
    const state = { box: 2, dueAt: now + DAY_MS }
    expect(nextState(state, true, 'pick', now)).toEqual(state)
    expect(nextState(state, true, 'sprint', now)).toEqual(state)
  })
})

describe('statusForBox', () => {
  it('maps boxes to statuses', () => {
    expect([0, 1, 4, 5].map(statusForBox)).toEqual(['new', 'learning', 'learning', 'mastered'])
  })
})

describe('hintFor', () => {
  it('confirms a matching rule', () => {
    expect(hintFor('Wohnung', 'die')).toMatchObject({ predicts: 'die', exception: false })
  })
  it('flags exceptions', () => {
    expect(hintFor('Käse', 'der')).toMatchObject({ predicts: 'die', exception: true })
  })
  it('returns null when no rule applies', () => {
    expect(hintFor('Tisch', 'der')).toBeNull()
  })
})

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const days = [0, 1, 2].map((i) => localDate(now - i * DAY_MS))
    expect(computeStreak(days, now)).toBe(3)
  })
  it('keeps the streak alive if today has no activity yet', () => {
    const days = [1, 2].map((i) => localDate(now - i * DAY_MS))
    expect(computeStreak(days, now)).toBe(2)
  })
  it('breaks after a gap', () => {
    const days = [0, 2].map((i) => localDate(now - i * DAY_MS))
    expect(computeStreak(days, now)).toBe(1)
  })
})
