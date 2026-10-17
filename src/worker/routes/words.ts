import { zValidator } from '@hono/zod-validator'
import { and, asc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { chunk } from '@shared/chunk'
import { deleteWordsSchema, levelSchema } from '@shared/schemas'
import { statusForBox } from '@shared/srs'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { words, userWordProgress: progress } = schema

const querySchema = z.object({
  level: levelSchema.optional(),
  status: z.enum(['new', 'learning', 'mastered']).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
})
const PAGE_SIZE = 50
// Each id is one bound parameter; D1 allows at most 100 per statement.
const DELETE_CHUNK = 50

export const wordsRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', querySchema), async (c) => {
  const { db, userId } = c.var
  const { level, status, q, page } = c.req.valid('query')
  const box = sql`coalesce(${progress.box}, 0)`
  const pattern = q ? `%${q.replace(/[%_]/g, '')}%` : null
  const where = and(
    level ? eq(words.level, level) : undefined,
    pattern ? or(like(words.lemma, pattern), like(words.translation, pattern)) : undefined,
    status === 'new' ? or(isNull(progress.wordId), eq(progress.box, 0)) : undefined,
    status === 'learning' ? sql`${box} between 1 and 4` : undefined,
    status === 'mastered' ? sql`${box} = 5` : undefined,
  )
  const base = db
    .select({
      id: words.id,
      article: words.article,
      lemma: words.lemma,
      translation: words.translation,
      level: words.level,
      box,
      seen: sql<number>`coalesce(${progress.seen}, 0)`,
      correct: sql<number>`coalesce(${progress.correct}, 0)`,
      wrong: sql<number>`coalesce(${progress.wrong}, 0)`,
    })
    .from(words)
    .leftJoin(progress, and(eq(progress.wordId, words.id), eq(progress.userId, userId)))
    .where(where)

  const [rows, [count]] = await Promise.all([
    base.orderBy(asc(words.lemma)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db
      .select({ n: sql<number>`count(*)` })
      .from(words)
      .leftJoin(progress, and(eq(progress.wordId, words.id), eq(progress.userId, userId)))
      .where(where),
  ])
  return c.json({
    total: count?.n ?? 0,
    page,
    pageSize: PAGE_SIZE,
    items: rows.map((r) => ({ ...r, box: Number(r.box), status: statusForBox(Number(r.box)) })),
  })
})

  /**
   * Admin only. Removes words from the shared vocabulary; the foreign keys cascade, so every user's
   * progress and attempt history for these words goes with them.
   */
  .post('/delete', zValidator('json', deleteWordsSchema), async (c) => {
    if (!c.var.isAdmin) throw new HTTPException(403, { message: 'Only the admin can delete words' })
    const ids = [...new Set(c.req.valid('json').ids)]
    const { db } = c.var
    const [first, ...rest] = chunk(ids, DELETE_CHUNK).map((part) =>
      db.delete(words).where(inArray(words.id, part)).returning({ id: words.id }),
    )
    const results = first ? await db.batch([first, ...rest]) : []
    return c.json({ deleted: results.reduce((n, rows) => n + rows.length, 0) })
  })
