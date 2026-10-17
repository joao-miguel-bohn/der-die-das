# der · die · das

Learn German nouns together with their articles. Type `das Haus`, track your error rate, and let spaced repetition
bring back what you keep getting wrong. Runs entirely on the Cloudflare **free** plan.

- **Stack:** TypeScript 6.0.3, Node 24, React + Vite + Tailwind v4 + shadcn/ui, Hono, Cloudflare Workers + D1 (Drizzle), Better Auth (Google).
- **Learning engine:** Leitner boxes (1, 3, 7, 14, 30 days). A wrong answer sends the word back to box 1.
- **Modes:** *Type it* (article + word, spaced repetition), *Pick article* (der/die/das drill, weakest words first), *Sprint* (10 random words, timed).
- **Dashboard:** due words, streak, article vs. spelling accuracy, 30-day trend, der/die/das confusion grid, hardest words, progress per level.
- **Why Google only:** the free plan allows 10 ms CPU per request, which password hashing would exceed.

## Local development

```bash
nvm use                      # Node 24
npm install
cp .dev.vars.example .dev.vars   # then fill in the values (see below)
npm run types                # generate worker-configuration.d.ts
npm run db:migrate:local
npm run dev                  # http://localhost:5173
```

`.dev.vars` needs `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
and `BETTER_AUTH_URL=http://localhost:5173`.

Without Google credentials you can still exercise the app: `node scripts/dev-session.ts` creates a user and session in the
**local** database and prints a cookie (`better-auth.session_token=…`) you can paste into your browser's dev tools.

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:generate` (after editing `src/worker/db/schema.ts`).

## Google OAuth setup

Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URIs:

- `http://localhost:5173/api/auth/callback/google`
- `https://<your-worker>.<your-subdomain>.workers.dev/api/auth/callback/google`

## Deploy (free)

```bash
npx wrangler login
npx wrangler d1 create sprache-lernen        # copy database_id into wrangler.jsonc
```

In `wrangler.jsonc` set:

- `d1_databases[0].database_id` to the id from above,
- `vars.BETTER_AUTH_URL` to your final URL (`https://sprache-lernen.<subdomain>.workers.dev`),
- `vars.ADMIN_EMAIL` to the Google account allowed to import words,
- `vars.ALLOWED_EMAILS` to a comma-separated list of accounts allowed to sign in (empty = anyone with a Google account; recommended to set it).

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npm run db:migrate:remote
npm run deploy
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

## Free-plan budget

100k requests/day, 10 ms CPU/request, D1: 5M rows read and 100k rows written per day. One answer writes about 3 rows, so a
single learner is far below every limit.
