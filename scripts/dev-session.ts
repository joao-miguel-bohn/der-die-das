// Local development helper: creates a user + session in the LOCAL D1 database and prints a
// signed session cookie, so the API can be exercised without going through Google.
// Usage: node scripts/dev-session.ts [email]
import { createHmac, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const email = process.argv[2] ?? 'joao.miguel.bohn@gmail.com'
const vars = readFileSync('.dev.vars', 'utf8')
const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(vars)?.[1]
if (!secret) throw new Error('BETTER_AUTH_SECRET missing in .dev.vars')

const userId = `dev-${createHmac('sha256', 'id').update(email).digest('hex').slice(0, 16)}`
const token = randomBytes(24).toString('base64url')
const now = Date.now()
const expires = now + 7 * 86_400_000
const esc = (s: string) => s.replace(/'/g, "''")

const sql = [
  `INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('${userId}', 'Dev User', '${esc(email)}', 1, ${now}, ${now});`,
  `INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES ('${randomBytes(8).toString('hex')}', ${expires}, '${token}', ${now}, ${now}, '${userId}');`,
].join(' ')
execFileSync('npx', ['wrangler', 'd1', 'execute', 'sprache-lernen', '--local', '--command', sql], { stdio: 'ignore' })

const signature = createHmac('sha256', secret).update(token).digest('base64')
console.log(`better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`)
