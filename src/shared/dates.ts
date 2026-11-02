export const APP_TIMEZONE = 'Europe/Berlin'
export const DAY_MS = 86_400_000

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD in the app timezone. */
export function localDate(ms: number): string {
  return formatter.format(new Date(ms))
}

/** Consecutive days with activity, ending today (or yesterday if today has none yet). */
export function computeStreak(activeDates: Iterable<string>, now: number): number {
  const active = new Set(activeDates)
  let cursor = now
  if (!active.has(localDate(cursor))) cursor -= DAY_MS
  let streak = 0
  while (active.has(localDate(cursor))) {
    streak++
    cursor -= DAY_MS
  }
  return streak
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "3 hours ago", "yesterday", "in 2 days", "just now". */
export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = (ms - now) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
