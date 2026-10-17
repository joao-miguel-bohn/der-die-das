import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb, schema } from './db'

export function isEmailAllowed(env: Env, email: string): boolean {
  const allowed = env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return allowed.length === 0 || allowed.includes(email.toLowerCase())
}

export function getAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
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
