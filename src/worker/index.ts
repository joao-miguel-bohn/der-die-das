import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getAuth } from './auth'
import { requireUser, type AppEnv } from './middleware'
import { importRoutes } from './routes/import'
import { settingsRoutes } from './routes/settings'
import { statsRoutes } from './routes/stats'
import { studyRoutes } from './routes/study'
import { wordsRoutes } from './routes/words'

const api = new Hono<AppEnv>()
  .use(requireUser)
  .get('/me', (c) => c.json({ userId: c.var.userId, email: c.var.email, isAdmin: c.var.isAdmin }))
  .route('/study', studyRoutes)
  .route('/stats', statsRoutes)
  .route('/words', wordsRoutes)
  .route('/import', importRoutes)
  .route('/settings', settingsRoutes)

const app = new Hono<AppEnv>()
  .on(['GET', 'POST'], '/api/auth/*', (c) => getAuth(c.env).handler(c.req.raw))
  .route('/api', api)
  .onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Internal error' }, 500)
  })

export type AppType = typeof app
export default app
