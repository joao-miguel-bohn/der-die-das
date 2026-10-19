import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, gt, gte, lte, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { computeStreak, DAY_MS, localDate } from '@shared/dates'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { words, userWordProgress: progress, attempts, dailyStats, userSettings } = schema

export const statsRoutes = new Hono<AppEnv>()
  .get('/overview', async (c) => {
    const { db, userId } = c.var
    const now = Date.now()
    const today = localDate(now)

    const perLevel = await db
      .select({
        level: words.level,
        total: sql<number>`count(*)`,
        fresh: sql<number>`sum(case when ${progress.box} is null or ${progress.box} = 0 then 1 else 0 end)`,
        learning: sql<number>`sum(case when ${progress.box} between 1 and 4 then 1 else 0 end)`,
        mastered: sql<number>`sum(case when ${progress.box} = 5 then 1 else 0 end)`,
      })
      .from(words)
      .leftJoin(progress, and(eq(progress.wordId, words.id), eq(progress.userId, userId)))
      .groupBy(words.level)
      .orderBy(words.level)

    const [due] = await db
      .select({ n: sql<number>`count(*)` })
      .from(progress)
      .where(and(eq(progress.userId, userId), gt(progress.box, 0), lte(progress.dueAt, now)))

    const [acc] = await db
      .select({
        total: sql<number>`count(*)`,
        articleOk: sql<number>`coalesce(sum(${attempts.articleOk}), 0)`,
        typedTotal: sql<number>`coalesce(sum(case when ${attempts.mode} = 'type' then 1 else 0 end), 0)`,
        lemmaOk: sql<number>`coalesce(sum(case when ${attempts.mode} = 'type' then ${attempts.lemmaOk} else 0 end), 0)`,
      })
      .from(attempts)
      // Learn-mode guesses on unlearned words would drag down accuracy without measuring recall.
      .where(and(eq(attempts.userId, userId), ne(attempts.mode, 'learn')))

    const dates = await db
      .select({ date: dailyStats.date })
      .from(dailyStats)
      .where(eq(dailyStats.userId, userId))
      .orderBy(desc(dailyStats.date))
      .limit(400)

    const [todayRow] = await db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, today)))

    const [started] = await db
      .select({ n: sql<number>`count(*)` })
      .from(progress)
      .where(and(eq(progress.userId, userId), eq(progress.firstSeenDate, today)))
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId))

    const totals = perLevel.reduce(
      (t, l) => ({
        total: t.total + l.total,
        fresh: t.fresh + (l.fresh ?? 0),
        learning: t.learning + (l.learning ?? 0),
        mastered: t.mastered + (l.mastered ?? 0),
      }),
      { total: 0, fresh: 0, learning: 0, mastered: 0 },
    )

    return c.json({
      levels: perLevel.map((l) => ({
        level: l.level,
        total: l.total,
        fresh: l.fresh ?? 0,
        learning: l.learning ?? 0,
        mastered: l.mastered ?? 0,
      })),
      totals,
      dueNow: due?.n ?? 0,
      newLeftToday: Math.max(0, (settings?.dailyNewLimit ?? 10) - (started?.n ?? 0)),
      streak: computeStreak(dates.map((d) => d.date), now),
      today: { attempts: todayRow?.attempts ?? 0, correct: todayRow?.correct ?? 0 },
      accuracy: {
        attempts: acc?.total ?? 0,
        article: acc?.total ? (acc.articleOk ?? 0) / acc.total : null,
        lemma: acc?.typedTotal ? (acc.lemmaOk ?? 0) / acc.typedTotal : null,
      },
    })
  })

  .get('/trend', zValidator('query', z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })), async (c) => {
    const { db, userId } = c.var
    const { days } = c.req.valid('query')
    const now = Date.now()
    const since = localDate(now - (days - 1) * DAY_MS)
    const rows = await db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, since)))
    const byDate = new Map(rows.map((r) => [r.date, r]))
    const series = Array.from({ length: days }, (_, i) => {
      const date = localDate(now - (days - 1 - i) * DAY_MS)
      const row = byDate.get(date)
      const attemptsCount = row?.attempts ?? 0
      return {
        date,
        attempts: attemptsCount,
        correct: row?.correct ?? 0,
        accuracy: attemptsCount ? Math.round(((row?.correct ?? 0) / attemptsCount) * 100) : null,
      }
    })
    return c.json({ series })
  })

  .get('/confusion', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select({
        correct: attempts.correctArticle,
        chosen: sql<string>`coalesce(${attempts.chosenArticle}, 'none')`,
        n: sql<number>`count(*)`,
      })
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .groupBy(attempts.correctArticle, sql`coalesce(${attempts.chosenArticle}, 'none')`)
    return c.json({ cells: rows })
  })

  .get('/hardest', zValidator('query', z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) })), async (c) => {
    const { db, userId } = c.var
    const { limit } = c.req.valid('query')
    const rows = await db
      .select({
        id: words.id,
        article: words.article,
        lemma: words.lemma,
        translation: words.translation,
        level: words.level,
        seen: progress.seen,
        wrong: progress.wrong,
      })
      .from(progress)
      .innerJoin(words, eq(words.id, progress.wordId))
      .where(and(eq(progress.userId, userId), gt(progress.wrong, 0)))
      .orderBy(desc(sql`cast(${progress.wrong} as real) / ${progress.seen}`), desc(progress.wrong))
      .limit(limit)
    return c.json({ words: rows })
  })
