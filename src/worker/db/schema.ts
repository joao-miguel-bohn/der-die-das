import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// ---------- Better Auth tables ----------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// ---------- App tables ----------

/** Global vocabulary shared by every user. */
export const words = sqliteTable(
  'words',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    article: text('article', { enum: ['der', 'die', 'das'] }).notNull(),
    lemma: text('lemma').notNull(),
    translation: text('translation').notNull(),
    level: text('level', { enum: ['A1', 'A2', 'B1'] }).notNull(),
    plural: text('plural'),
    example: text('example'),
  },
  (t) => [
    uniqueIndex('words_lemma_article_uq').on(t.lemma, t.article),
    index('words_level_idx').on(t.level),
  ],
)

/** Per-user Leitner state. box 0 = never answered; 1-5 = Leitner boxes. */
export const userWordProgress = sqliteTable(
  'user_word_progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    wordId: integer('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    box: integer('box').notNull().default(0),
    dueAt: integer('due_at').notNull().default(0), // epoch ms
    seen: integer('seen').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    wrong: integer('wrong').notNull().default(0),
    lastSeenAt: integer('last_seen_at'),
    firstSeenDate: text('first_seen_date'), // YYYY-MM-DD in app timezone; drives the daily new-word limit
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.wordId] }),
    index('uwp_user_due_idx').on(t.userId, t.dueAt),
  ],
)

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    wordId: integer('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    mode: text('mode', { enum: ['type', 'pick', 'sprint'] }).notNull(),
    typed: text('typed'),
    chosenArticle: text('chosen_article'),
    correctArticle: text('correct_article').notNull(),
    articleOk: integer('article_ok', { mode: 'boolean' }).notNull(),
    lemmaOk: integer('lemma_ok', { mode: 'boolean' }).notNull(),
    createdAt: integer('created_at').notNull(), // epoch ms
  },
  (t) => [
    index('attempts_user_created_idx').on(t.userId, t.createdAt),
    index('attempts_user_word_idx').on(t.userId, t.wordId),
  ],
)

export const dailyStats = sqliteTable(
  'daily_stats',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD (UTC)
    attempts: integer('attempts').notNull().default(0),
    correct: integer('correct').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
)

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  dailyNewLimit: integer('daily_new_limit').notNull().default(10),
})
