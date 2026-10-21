import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb, schema } from './db'

export function isEmailAllowed(env: Env, email: string): boolean {
  const allowed = env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowed.length === 0 || allowed.includes(email.toLowerCase())
}

/**
 * BETTER_AUTH_URL lists every origin the app is served from, comma-separated; the first is the fallback.
 * Each sign-in builds Google's callback URL from the domain it started on, so the OAuth state cookie
 * is always sent back. Requests from other hosts are refused.
 */
export function authUrls(env: Pick<Env, 'BETTER_AUTH_URL'>) {
  const origins = env.BETTER_AUTH_URL.split(',').map((u) => new URL(u.trim()).origin)
  const [fallback] = origins
  if (!fallback) throw new Error('BETTER_AUTH_URL must list at least one origin')
  return {
    // "auto" takes the protocol from the request: https when deployed, http on localhost.
    baseURL: { allowedHosts: origins.map((o) => new URL(o).host), fallback, protocol: 'auto' as const },
    trustedOrigins: origins,
  }
}

export function getAuth(env: Env) {
  const { baseURL, trustedOrigins } = authUrls(env)
  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(getDb(env), { provider: 'sqlite', schema }),
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    },
    session: {
      // Avoids a D1 read on every API call.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    databaseHooks: {
      user: {
        create: {
          // Blocks sign-ups from emails outside ALLOWED_EMAILS (protects the free quota).
          before: async (user) => (isEmailAllowed(env, user.email) ? { data: user } : false),
        },
      },
    },
  })
}
