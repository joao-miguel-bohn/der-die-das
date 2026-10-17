# der · die · das

Learn German nouns together with their articles. Type `das Haus`, track your error rate, and let spaced repetition
bring back what you keep getting wrong. Runs entirely on the Cloudflare **free** plan.

- **Stack:** TypeScript 6.0.3, Node 24, pnpm 12.14.0, React + Vite + Tailwind v4 + shadcn/ui, Hono, Cloudflare Workers + D1 (Drizzle), Better Auth (Google).
- **Learning engine:** Leitner boxes (1, 3, 7, 14, 30 days). A wrong answer sends the word back to box 1.
- **Modes:** *Type it* (article + word, spaced repetition), *Pick article* (der/die/das drill, weakest words first), *Sprint* (10 random words, timed).
- **Dashboard:** due words, streak, article vs. spelling accuracy, 30-day trend, der/die/das confusion grid, hardest words, progress per level.
- **Managing words:** the admin can delete words (one or many) from the Words page; this removes them for everyone, including all users' progress on them. Every user can reset the progress of individual or selected words, or everything (Settings → Reset progress, which also clears history, charts and streak).
- **Why Google only:** the free plan allows 10 ms CPU per request, which password hashing would exceed.

## Local development

```bash
nvm use                      # Node 24
corepack enable              # uses the pnpm version pinned in package.json
pnpm install
cp .dev.vars.example .dev.vars   # then fill in the values (see below)
pnpm run types                # generate worker-configuration.d.ts
pnpm run db:migrate:local
pnpm run dev                  # http://localhost:5173
```

`.dev.vars` needs `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
and `BETTER_AUTH_URL=http://localhost:5173`.

Without Google credentials you can still exercise the app: `node scripts/dev-session.ts` creates a user and session in the
**local** database and prints a cookie (`better-auth.session_token=…`) you can paste into your browser's dev tools.

Other scripts: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run db:generate` (after editing `src/worker/db/schema.ts`).

## Google OAuth setup

Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URIs:

- `http://localhost:5173/api/auth/callback/google`
- `https://<your-worker>.<your-subdomain>.workers.dev/api/auth/callback/google`

## Deploy (free)

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create sprache-lernen        # copy database_id into wrangler.jsonc
```

In `wrangler.jsonc` set:

- `d1_databases[0].database_id` to the id from above,
- `vars.BETTER_AUTH_URL` to your final URL (`https://sprache-lernen.<subdomain>.workers.dev`),
- `vars.ADMIN_EMAIL` to the Google account allowed to import words,
- `vars.ALLOWED_EMAILS` to a comma-separated list of accounts allowed to sign in (empty = anyone with a Google account; recommended to set it).

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm run db:migrate:remote
pnpm run deploy
```

After the first deploy, open Workers & Pages → your worker → Observability and confirm CPU time stays well under 10 ms.

## Importing words

Sign in with the admin account and open **Import**. CSV (comma, semicolon or tab) or JSON; see
[samples/words.sample.csv](samples/words.sample.csv).

| column | required | notes |
|---|---|---|
| `article` | no | `der` / `die` / `das`. Can be omitted if `word` starts with the article (`das Haus`). |
| `word` | yes | also accepted: `lemma`, `wort`, `german`, `deutsch` |
| `translation` | yes | also accepted: `english`, `portuguese`, `meaning` |
| `level` | yes | `A1`, `A2` or `B1` |
| `plural`, `example` | no | shown after answering |

Re-importing the same word (same article + word) updates it, so you can fix the lists and import again; progress is kept.

## Security notes

- **Headers:** the app ships a strict Content-Security-Policy and related headers via [public/_headers](public/_headers) (static pages) and Hono `secureHeaders` (API). Scripts, fonts, images and network calls are limited to the app's own origin; inline *styles* are allowed because the UI libraries set style attributes at runtime.
- **zod runs without JIT in the browser** ([src/web/zod-config.ts](src/web/zod-config.ts)) so the CSP doesn't need `unsafe-eval`. Keep that import first in `main.tsx`.
- **Request size:** JSON bodies are capped at 16 KB (1 MB for the word import).
- **Rate limiting:** not done in code. Add a Cloudflare WAF rate-limiting rule for `/api/*` in the dashboard (Security → WAF → Rate limiting rules; the free plan includes one rule), e.g. 120 requests per 10 seconds per IP.
- **Access control:** set `ALLOWED_EMAILS` in `wrangler.jsonc` to restrict who can sign in; leave it empty to allow any Google account.
- **CI:** the Cloudflare token is only exposed to the deploy step; GitHub Actions are pinned to commit SHAs (Dependabot keeps them current).

## Free-plan budget

100k requests/day, 10 ms CPU/request, D1: 5M rows read and 100k rows written per day. One answer writes about 3 rows, so a
single learner is far below every limit.
