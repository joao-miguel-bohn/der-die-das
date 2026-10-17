import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { settingsSchema } from '@shared/schemas'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { userSettings } = schema

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const [row] = await c.var.db.select().from(userSettings).where(eq(userSettings.userId, c.var.userId))
    return c.json({ dailyNewLimit: row?.dailyNewLimit ?? 10 })
  })
  .put('/', zValidator('json', settingsSchema), async (c) => {
    const { dailyNewLimit } = c.req.valid('json')
    await c.var.db
      .insert(userSettings)
      .values({ userId: c.var.userId, dailyNewLimit })
      .onConflictDoUpdate({ target: userSettings.userId, set: { dailyNewLimit } })
    return c.json({ dailyNewLimit })
  })
