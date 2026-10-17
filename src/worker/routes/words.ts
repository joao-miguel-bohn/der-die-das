import { zValidator } from '@hono/zod-validator'
import { and, asc, eq, isNull, like, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { levelSchema } from '@shared/schemas'
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

export const wordsRoutes = new Hono<AppEnv>().get('/', zValidator('query', querySchema), async (c) => {
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
