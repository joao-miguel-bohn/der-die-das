import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../../src/worker/middleware'
import * as schema from '../../src/worker/db/schema'
import { adminRoutes } from '../../src/worker/routes/admin'

function appAs(isAdmin: boolean) {
  const queries: string[] = []
  const db = drizzle(async (sql) => { queries.push(sql); return { rows: [] } }, { schema })
  const app = new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('isAdmin', isAdmin)
      c.set('db', db as unknown as AppEnv['Variables']['db'])
      await next()
    })
    .route('/admin', adminRoutes)
    .onError((err, c) => c.json({ error: err.message }, err instanceof HTTPException ? err.status : 500))
  return { app, queries }
}

describe('GET /admin/users', () => {
  it('refuses non-admins without touching the database', async () => {
    const { app, queries } = appAs(false)
    const res = await app.request('/admin/users')
    expect(res.status).toBe(403)
    expect(queries).toHaveLength(0)
  })

  it('ties every per-user figure to the outer user row', async () => {
    const { app, queries } = appAs(true)
    const res = await app.request('/admin/users')
    expect(res.status).toBe(200)
    const [list = ''] = queries
    // attempts and user_word_progress both have columns that would shadow an unqualified "id".
    expect(list).not.toMatch(/"user_id" = "id"/)
    expect(list.match(/= "user"\."id"/g)?.length).toBeGreaterThanOrEqual(7)
  })
})
