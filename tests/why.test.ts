import { describe, expect, it } from 'vitest'
import { DAY_MS } from '@shared/dates'
import { whyThisWord, type WordHistory } from '@shared/why'

const now = 1_800_000_000_000
const HOUR = 3_600_000
const h = (over: Partial<WordHistory>): WordHistory => ({ box: 0, dueAt: 0, lastSeenAt: now - DAY_MS, seen: 3, correct: 2, wrong: 1, ...over })

describe('whyThisWord', () => {
  it('explains a review that came back after a miss', () => {
    const t = now - 3 * HOUR
    expect(whyThisWord('type', 'due', h({ box: 1, dueAt: t, lastSeenAt: t }), now)).toBe("You got it wrong 3 hours ago, so it's back for review.")
  })
  it('explains a scheduled review with its box interval', () => {
    expect(whyThisWord('type', 'due', h({ box: 2, dueAt: now - 2 * HOUR }), now)).toBe('Box 2 of 5 (every 3 days): it was due 2 hours ago.')
    expect(whyThisWord('type', 'due', h({ box: 1, dueAt: now - DAY_MS, lastSeenAt: now - 2 * DAY_MS }), now)).toBe('Box 1 of 5 (every day): it was due yesterday.')
  })
  it('explains words new to Type it and practice ahead', () => {
    expect(whyThisWord('type', 'new', h({}), now)).toBe("You've met it in Learn but haven't typed it yet; last seen yesterday.")
    expect(whyThisWord('type', 'ahead', h({ box: 3, dueAt: now + 2 * DAY_MS }), now)).toBe("Nothing is due, so you're practicing ahead: box 3 of 5, next due in 2 days.")
  })
  it('tells weak Pick words apart from random ones', () => {
    expect(whyThisWord('pick', 'practice', h({ wrong: 2, seen: 4 }), now)).toBe('One of your weakest: missed 2 times out of 4.')
    expect(whyThisWord('pick', 'practice', h({ wrong: 0, correct: 1, seen: 1 }), now)).toBe("A random word you've met in Learn; right once out of 1.")
    expect(whyThisWord('sprint', 'practice', h({ wrong: 2 }), now)).toBe("A random word you've met in Learn; right 2 times out of 3.")
  })
  it('explains Learn picks', () => {
    expect(whyThisWord('learn', 'new', null, now)).toBe("You haven't seen this word yet.")
    expect(whyThisWord('learn', 'practice', h({ wrong: 2, correct: 1, seen: 3 }), now)).toBe("You've missed it 2 times out of 3, so it's back in Learn before it moves on to Type it.")
  })
})
