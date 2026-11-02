import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../../src/worker/middleware'
import * as schema from '../../src/worker/db/schema'
import { studyRoutes } from '../../src/worker/routes/study'

// Rows in column order: words is id, article, lemma, translation, level, plural, example.
const EHEFRAU = [1, 'die', 'Ehefrau', 'wife', 'A1', 'Ehefrauen', null]

function appWith(others: unknown[][]) {
  const queries: string[] = []
  const db = drizzle(
    async (sql) => {
      queries.push(sql)
      if (sql.startsWith('select "id", "article"')) return { rows: [EHEFRAU] }
      if (sql.startsWith('select "article", "lemma", "translation" from "words"')) return { rows: others }
      return { rows: [] }
    },
    async (batch) => { queries.push(...batch.map((q) => q.sql)); return batch.map(() => ({ rows: [] })) },
    { schema },
  )
  const app = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('userId', 'u1')
      c.set('db', db as unknown as AppEnv['Variables']['db'])
      await next()
    })
    .route('/study', studyRoutes)
  const answer = (typed: string) =>
    app.request('/study/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'type', wordId: 1, typed }),
    })
  return { answer, queries }
}

describe('POST /study/answer (Type it)', () => {
  it('treats another word with the same meaning as a retry and records nothing', async () => {
    const { answer, queries } = appWith([['die', 'Frau', 'woman; wife; Mrs.']])
    const res = await answer('der frau')
    expect(await res.json()).toEqual({ sameMeaning: { article: 'die', lemma: 'Frau', articleOk: false } })
    expect(queries.some((q) => q.startsWith('insert'))).toBe(false)
  })

  it('counts a word with a different meaning as a miss', async () => {
    const { answer, queries } = appWith([['die', 'Hausfrau', 'housewife']])
    const res = await answer('die Hausfrau')
    expect(await res.json()).toMatchObject({ correct: false, lemmaOk: false })
    expect(queries.some((q) => q.startsWith('insert into "attempts"'))).toBe(true)
  })
})
