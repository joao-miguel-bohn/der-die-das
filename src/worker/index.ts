import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { getAuth } from './auth'
import { requireUser, type AppEnv } from './middleware'
import { importRoutes } from './routes/import'
import { settingsRoutes } from './routes/settings'
import { statsRoutes } from './routes/stats'
import { studyRoutes } from './routes/study'
import { wordsRoutes } from './routes/words'

// Requests are small JSON documents; only the word import (up to 500 rows) is larger.
const smallBody = bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Request too large' }, 413) })
const importBody = bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: 'Request too large' }, 413) })

const api = new Hono<AppEnv>()
  .use(requireUser)
  .get('/me', (c) => c.json({ userId: c.var.userId, email: c.var.email, isAdmin: c.var.isAdmin }))
  .route('/study', studyRoutes)
  .route('/stats', statsRoutes)
  .route('/words', wordsRoutes)
  .route('/import', importRoutes)
  .route('/settings', settingsRoutes)

const app = new Hono<AppEnv>()
  // The static app gets its headers from public/_headers; this covers every /api response.
  .use(
    '/api/*',
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      strictTransportSecurity: 'max-age=31536000',
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
    }),
    async (c, next) => {
      c.header('Cache-Control', 'no-store')
      await next()
    },
    (c, next) => (c.req.path === '/api/import' ? importBody(c, next) : smallBody(c, next)),
  )
  .on(['GET', 'POST'], '/api/auth/*', (c) => getAuth(c.env).handler(c.req.raw))
  .route('/api', api)
  .onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    console.error(err)
    return c.json({ error: 'Internal error' }, 500)
  })

export type AppType = typeof app
export default app
