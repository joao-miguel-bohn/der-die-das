import type { Mode, WordStatus } from './types'
import { DAY_MS } from './dates'

/** Review interval in days for each Leitner box (index = box). Box 0 = new. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const
export const MAX_BOX = 5

export interface ProgressState {
  box: number
  dueAt: number
}

/** Only typing the full answer proves recall well enough to promote a word. */
export function promotes(mode: Mode): boolean {
  return mode === 'type'
}

/**
 * Wrong answers always send the word back to box 1, due immediately.
 * Correct answers promote one box (typing mode only) and push the due date out.
 * Correct answers in other modes leave the schedule untouched.
 */
export function nextState(current: ProgressState, correct: boolean, mode: Mode, now: number): ProgressState {
  if (!correct) return { box: 1, dueAt: now }
  if (!promotes(mode)) return current
  const box = Math.min(current.box + 1, MAX_BOX)
  return { box, dueAt: now + (BOX_INTERVAL_DAYS[box] ?? 30) * DAY_MS }
}

export function statusForBox(box: number): WordStatus {
  if (box <= 0) return 'new'
  return box >= MAX_BOX ? 'mastered' : 'learning'
}
