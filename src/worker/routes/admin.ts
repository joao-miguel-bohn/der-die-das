import { zValidator } from '@hono/zod-validator'
import { and, asc, between, desc, eq, gte, like, or, sql, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { DAY_MS, localDate } from '@shared/dates'
import { adminUsersQuerySchema } from '@shared/schemas'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { user, words, userWordProgress: progress, attempts, dailyStats } = schema
const PAGE_SIZE = 25
const ACTIVE_WINDOW_DAYS = 30

export const adminRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    if (!c.var.isAdmin) throw new HTTPException(403, { message: 'Admins only' })
    await next()
  })

  /** Every account with a summary of its progress. One row per user; each figure is an indexed per-user lookup. */
  .get('/users', zValidator('query', adminUsersQuerySchema), async (c) => {
    const { db } = c.var
    const { page, q, sort } = c.req.valid('query')
    const pattern = q ? `%${q.replace(/[%_]/g, '')}%` : null
    const where = pattern ? or(like(user.email, pattern), like(user.name, pattern)) : undefined
    const since = localDate(Date.now() - (ACTIVE_WINDOW_DAYS - 1) * DAY_MS)

    // Per-user figures as correlated subqueries. Built with the query builder so every column is table-qualified:
    // attempts.id would otherwise shadow user.id.
    const perUser = <T>(table: typeof attempts | typeof progress | typeof dailyStats, value: SQL, ...filters: SQL[]) =>
      sql<T>`(${db.select({ v: value }).from(table).where(and(eq(table.userId, user.id), ...filters))})`
    const lastActiveAt = perUser<number | null>(attempts, sql`max(${attempts.createdAt})`)
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        lastActiveAt,
        metInLearn: perUser<number>(attempts, sql`count(distinct ${attempts.wordId})`, eq(attempts.mode, 'learn')),
        learning: perUser<number>(progress, sql`count(*)`, between(progress.box, 1, 4)),
        mastered: perUser<number>(progress, sql`count(*)`, eq(progress.box, 5)),
        // daily_stats leaves out Learn guesses, so this is quiz accuracy.
        answers: perUser<number>(dailyStats, sql`coalesce(sum(${dailyStats.attempts}), 0)`),
        correct: perUser<number>(dailyStats, sql`coalesce(sum(${dailyStats.correct}), 0)`),
        activeDays: perUser<number>(dailyStats, sql`count(*)`, gte(dailyStats.date, since)),
      })
      .from(user)
      .where(where)
      .orderBy(...(sort === 'joined' ? [desc(user.createdAt)] : [sql`${lastActiveAt} is null`, desc(lastActiveAt), desc(user.createdAt)]), asc(user.email))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE)

    const [[count], [vocab]] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(user).where(where),
      db.select({ n: sql<number>`count(*)` }).from(words),
    ])

    return c.json({
      total: count?.n ?? 0,
      page,
      pageSize: PAGE_SIZE,
      totalWords: vocab?.n ?? 0,
      activeWindowDays: ACTIVE_WINDOW_DAYS,
      items: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.getTime(),
        accuracy: r.answers ? r.correct / r.answers : null,
      })),
    })
  })
