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
