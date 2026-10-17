import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { getAuth, isEmailAllowed } from './auth'
import { getDb, type Db } from './db'

export interface AppEnv {
  Bindings: Env
  Variables: {
    userId: string
    email: string
    isAdmin: boolean
    db: Db
  }
}

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers })
  if (!session) throw new HTTPException(401, { message: 'Not signed in' })
  const { id, email, emailVerified } = session.user
  if (!isEmailAllowed(c.env, email)) throw new HTTPException(403, { message: 'This account is not allowed' })
  c.set('userId', id)
  c.set('email', email)
  // Admin status needs a verified address, so it can't be claimed by an unverified account.
  c.set('isAdmin', emailVerified && email.toLowerCase() === c.env.ADMIN_EMAIL.toLowerCase())
  c.set('db', getDb(c.env))
  await next()
})
