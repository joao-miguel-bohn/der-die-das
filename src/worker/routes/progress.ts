import { zValidator } from '@hono/zod-validator'
import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { chunk } from '@shared/chunk'
import { resetProgressSchema } from '@shared/schemas'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { userWordProgress: progress, attempts, dailyStats } = schema
const CHUNK = 40 // two bound parameters besides the ids

export const progressRoutes = new Hono<AppEnv>().post('/reset', zValidator('json', resetProgressSchema), async (c) => {
  const { db, userId } = c.var
  const body = c.req.valid('json')

  if (body.scope === 'all') {
    // Everything this user has learned: Leitner state, answer history, and the daily stats behind
    // the streak and the trend chart. Settings are kept.
    const [progressRows] = await db.batch([
      db.delete(progress).where(eq(progress.userId, userId)).returning({ id: progress.wordId }),
      db.delete(attempts).where(eq(attempts.userId, userId)),
      db.delete(dailyStats).where(eq(dailyStats.userId, userId)),
    ])
    return c.json({ scope: 'all', wordsReset: progressRows.length })
  }

  // Per word: Leitner state and answer history for those words. Daily totals are aggregates and stay.
  const ids = [...new Set(body.wordIds)]
  const statements = chunk(ids, CHUNK).flatMap((part) => [
    db.delete(progress).where(and(eq(progress.userId, userId), inArray(progress.wordId, part))).returning({ id: progress.wordId }),
    db.delete(attempts).where(and(eq(attempts.userId, userId), inArray(attempts.wordId, part))),
  ])
  const [first, ...rest] = statements
  const results = first ? await db.batch([first, ...rest]) : []
  // Results alternate: progress rows (returning), then attempts (no rows).
  const wordsReset = results.reduce((n, rows, i) => (i % 2 === 0 ? n + (rows as unknown[]).length : n), 0)
  return c.json({ scope: 'words', wordsReset })
})
