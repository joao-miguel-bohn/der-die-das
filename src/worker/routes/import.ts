import { zValidator } from '@hono/zod-validator'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { importPayloadSchema } from '@shared/schemas'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const BATCH = 50

export const importRoutes = new Hono<AppEnv>().post('/', zValidator('json', importPayloadSchema), async (c) => {
  if (!c.var.isAdmin) throw new HTTPException(403, { message: 'Only the admin can import words' })
  const { rows } = c.req.valid('json')
  const { db } = c.var
  const { words } = schema
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    // One statement per row keeps each query under D1's 100 bound-parameter limit.
    const [first, ...rest] = chunk.map((r) =>
      db
        .insert(words)
        .values({
          article: r.article,
          lemma: r.lemma,
          translation: r.translation,
          level: r.level,
          plural: r.plural ?? null,
          example: r.example ?? null,
        })
        .onConflictDoUpdate({
          target: [words.lemma, words.article],
          set: {
            translation: sql`excluded.translation`,
            level: sql`excluded.level`,
            plural: sql`excluded.plural`,
            example: sql`excluded.example`,
          },
        }),
    )
    if (first) await db.batch([first, ...rest])
  }
  return c.json({ imported: rows.length })
})
