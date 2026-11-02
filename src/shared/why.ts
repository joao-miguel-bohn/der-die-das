import { timeAgo } from './dates'
import { BOX_INTERVAL_DAYS, MAX_BOX } from './srs'
import type { Mode } from './types'

/** A word's progress when the session was built: enough to say why it was picked. */
export interface WordHistory {
  box: number
  dueAt: number
  lastSeenAt: number | null
  seen: number
  correct: number
  wrong: number
}

export type WordKind = 'due' | 'new' | 'ahead' | 'practice'

const times = (n: number) => (n === 1 ? 'once' : `${n} times`)

/** One line telling the learner why this word is in the session. Mirrors the picking rules in the study route. */
export function whyThisWord(mode: Mode, kind: WordKind, h: WordHistory | null, now = Date.now()): string {
  if (!h) return "You haven't seen this word yet."
  const lastSeen = h.lastSeenAt === null ? null : timeAgo(h.lastSeenAt, now)

  if (mode === 'learn') {
    return `You've missed it ${times(h.wrong)} out of ${h.seen}, so it's back in Learn before it moves on to Type it.`
  }
  if (kind === 'due') {
    // A miss puts the word in box 1, due the moment it was answered.
    if (h.box === 1 && h.dueAt === h.lastSeenAt && lastSeen) return `You got it wrong ${lastSeen}, so it's back for review.`
    const days = BOX_INTERVAL_DAYS[h.box] ?? 30
    return `Box ${h.box} of ${MAX_BOX} (every ${days === 1 ? 'day' : `${days} days`}): it was due ${timeAgo(h.dueAt, now)}.`
  }
  if (kind === 'new') {
    return `You've met it in Learn but haven't typed it yet${lastSeen ? `; last seen ${lastSeen}` : ''}.`
  }
  if (kind === 'ahead') {
    return `Nothing is due, so you're practicing ahead: box ${h.box} of ${MAX_BOX}, next due ${timeAgo(h.dueAt, now)}.`
  }
  // Pick puts words you've missed first; everything else is a random word you've met in Learn.
  if (mode === 'pick' && h.wrong > 0) return `One of your weakest: missed ${times(h.wrong)} out of ${h.seen}.`
  return `A random word you've met in Learn${h.seen ? `; right ${times(h.correct)} out of ${h.seen}` : ''}.`
}
