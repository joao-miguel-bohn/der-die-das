import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq, exists, gt, isNull, lte, notInArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { checkPick, checkTyped, parseTyped } from '@shared/answer'
import { localDate } from '@shared/dates'
import { hintFor } from '@shared/hints'
import { maskLemma } from '@shared/peek'
import { answerPayloadSchema, peekQuerySchema, sessionQuerySchema } from '@shared/schemas'
import { nextState } from '@shared/srs'
import type { AppEnv } from '../middleware'
import { schema } from '../db'

const { words, userWordProgress: progress, attempts, dailyStats, userSettings } = schema

export interface StudyWord {
  id: number
  translation: string
  level: 'A1' | 'A2' | 'B1'
  /** Only sent for article-only modes, where the lemma is part of the question. */
  lemma?: string
  kind: 'due' | 'new' | 'practice'
}

export interface LearnWord {
  id: number
  lemma: string
  translation: string
  level: 'A1' | 'A2' | 'B1'
  article: 'der' | 'die' | 'das'
  plural: string | null
  example: string | null
  kind: 'new' | 'practice'
}

const DEFAULT_NEW_LIMIT = 10

export const studyRoutes = new Hono<AppEnv>()
  .get('/session', zValidator('query', sessionQuerySchema), async (c) => {
    const { mode, level, size } = c.req.valid('query')
    const db = c.var.db
    const userId = c.var.userId
    const now = Date.now()
    const levelFilter = level ? eq(words.level, level) : undefined
    const showLemma = mode !== 'type'
    const toItem = (r: { id: number; translation: string; level: 'A1' | 'A2' | 'B1'; lemma: string }, kind: StudyWord['kind']): StudyWord => ({
      id: r.id,
      translation: r.translation,
      level: r.level,
      kind,
      ...(showLemma ? { lemma: r.lemma } : {}),
    })
    const cols = { id: words.id, translation: words.translation, level: words.level, lemma: words.lemma }
    // Quiz modes only use words you have already been shown in Learn.
    const metInLearn = exists(
      db
        .select({ one: sql`1` })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), eq(attempts.wordId, words.id), eq(attempts.mode, 'learn'))),
    )

    if (mode === 'type') {
      const due = await db
        .select(cols)
        .from(progress)
        .innerJoin(words, eq(words.id, progress.wordId))
        .where(and(eq(progress.userId, userId), gt(progress.box, 0), lte(progress.dueAt, now), levelFilter))
        .orderBy(asc(progress.dueAt))
        .limit(size)

      const today = localDate(now)
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId))
      const limit = settings?.dailyNewLimit ?? DEFAULT_NEW_LIMIT
      const [{ n: startedToday = 0 } = {}] = await db
        .select({ n: sql<number>`count(*)` })
        .from(progress)
        .where(and(eq(progress.userId, userId), eq(progress.firstSeenDate, today)))
      const newAllowed = Math.max(0, Math.min(size - due.length, limit - startedToday))

      // Most recently learned first, so learning flows straight into typing.
      const fresh = newAllowed
        ? await db
            .select(cols)
            .from(progress)
            .innerJoin(words, eq(words.id, progress.wordId))
            .where(and(eq(progress.userId, userId), eq(progress.box, 0), metInLearn, levelFilter))
            .orderBy(desc(progress.lastSeenAt))
            .limit(newAllowed)
        : []
      return c.json({
        items: [...due.map((r) => toItem(r, 'due')), ...fresh.map((r) => toItem(r, 'new'))],
      })
    }

    if (mode === 'learn') {
      const learnCols = {
        id: words.id,
        lemma: words.lemma,
        translation: words.translation,
        level: words.level,
        article: words.article,
        plural: words.plural,
        example: words.example,
      }
      // Up to half the session: words not yet in the quiz boxes that were missed more often than known.
      const struggling = await db
        .select(learnCols)
        .from(progress)
        .innerJoin(words, eq(words.id, progress.wordId))
        .where(and(eq(progress.userId, userId), eq(progress.box, 0), gt(progress.wrong, progress.correct), levelFilter))
        .orderBy(sql`random()`)
        .limit(Math.ceil(size / 2))
      const unseen = await db
        .select(learnCols)
        .from(words)
        .leftJoin(progress, and(eq(progress.wordId, words.id), eq(progress.userId, userId)))
        .where(and(isNull(progress.wordId), levelFilter))
        .orderBy(sql`random()`)
        .limit(size - struggling.length)

      const strugglingIds = new Set(struggling.map((w) => w.id))
      const items = [...struggling, ...unseen].sort(() => Math.random() - 0.5)
      return c.json({
        items: items.map((r): LearnWord => ({
          ...r,
          kind: strugglingIds.has(r.id) ? 'practice' : 'new',
        })),
      })
    }

    if (mode === 'pick') {
      // Weakest words first (highest error rate), padded with random words.
      const weak = await db
        .select(cols)
        .from(progress)
        .innerJoin(words, eq(words.id, progress.wordId))
        .where(and(eq(progress.userId, userId), gt(progress.wrong, 0), metInLearn, levelFilter))
        .orderBy(desc(sql`cast(${progress.wrong} as real) / ${progress.seen}`), desc(progress.wrong))
        .limit(size)
      const fill = size - weak.length
      const extra = fill > 0
        ? await db
            .select(cols)
            .from(words)
            .where(and(weak.length ? notInArray(words.id, weak.map((w) => w.id)) : undefined, metInLearn, levelFilter))
            .orderBy(sql`random()`)
            .limit(fill)
        : []
      const items = [...weak, ...extra].sort(() => Math.random() - 0.5)
      return c.json({ items: items.map((r) => toItem(r, 'practice')) })
    }

    // sprint: random words
    const rows = await db.select(cols).from(words).where(and(metInLearn, levelFilter)).orderBy(sql`random()`).limit(size)
    return c.json({ items: rows.map((r) => toItem(r, 'practice')) })
  })

  .get('/peek', zValidator('query', peekQuerySchema), async (c) => {
    const { wordId, letters } = c.req.valid('query')
    const [word] = await c.var.db.select({ lemma: words.lemma }).from(words).where(eq(words.id, wordId))
    if (!word) throw new HTTPException(404, { message: 'Unknown word' })
    // Only the word: the article is what Type it is drilling.
    return c.json(maskLemma(word.lemma, letters))
  })

  .post('/answer', zValidator('json', answerPayloadSchema), async (c) => {
    const payload = c.req.valid('json')
    const db = c.var.db
    const userId = c.var.userId
    const now = Date.now()
    const today = localDate(now)

    const [word] = await db.select().from(words).where(eq(words.id, payload.wordId))
    if (!word) throw new HTTPException(404, { message: 'Unknown word' })

    if (payload.mode === 'learn') {
      // Guesses on unlearned words leave the Leitner schedule alone and stay out of daily_stats (accuracy trend).
      const knew = payload.chosenArticle === word.article
      await db.batch([
        db
          .insert(progress)
          .values({
            userId,
            wordId: word.id,
            box: 0,
            dueAt: 0,
            seen: 1,
            correct: knew ? 1 : 0,
            wrong: knew ? 0 : 1,
            lastSeenAt: now,
            firstSeenDate: null,
          })
          .onConflictDoUpdate({
            target: [progress.userId, progress.wordId],
            set: {
              seen: sql`${progress.seen} + 1`,
              correct: sql`${progress.correct} + ${knew ? 1 : 0}`,
              wrong: sql`${progress.wrong} + ${knew ? 0 : 1}`,
              lastSeenAt: now,
            },
          }),
        db.insert(attempts).values({
          userId,
          wordId: word.id,
          mode: 'learn',
          typed: null,
          chosenArticle: payload.chosenArticle,
          correctArticle: word.article,
          articleOk: knew,
          lemmaOk: true,
          createdAt: now,
        }),
      ])
      return c.json({ recorded: true })
    }

    const typed = payload.mode === 'type' ? payload.typed : null
    const chosen = payload.mode === 'type' ? parseTyped(payload.typed).article : payload.chosenArticle
    const check = payload.mode === 'type'
      ? checkTyped(payload.typed, word)
      : payload.chosenArticle
        ? checkPick(payload.chosenArticle, word)
        : { articleOk: false, lemmaOk: true, correct: false, capitalizationOnly: false }

    const [existing] = await db
      .select()
      .from(progress)
      .where(and(eq(progress.userId, userId), eq(progress.wordId, word.id)))
    const current = { box: existing?.box ?? 0, dueAt: existing?.dueAt ?? 0 }
    // A Pick/Sprint miss on a word never met in Learn would otherwise put it in the boxes, making it due in Type it.
    const unlearned = payload.mode !== 'type' && !check.correct && current.box === 0 && !(await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.wordId, word.id), eq(attempts.mode, 'learn')))
      .limit(1)).length
    // A correct answer after peeking at letters isn't full recall, so the word stays in its box.
    const peeked = payload.mode === 'type' && payload.peeked === true
    const next = unlearned || (peeked && check.correct) ? current : nextState(current, check.correct, payload.mode, now)

    await db.batch([
      db
        .insert(progress)
        .values({
          userId,
          wordId: word.id,
          box: next.box,
          dueAt: next.dueAt,
          seen: 1,
          correct: check.correct ? 1 : 0,
          wrong: check.correct ? 0 : 1,
          lastSeenAt: now,
          // Only words that entered the Leitner boxes count against the daily new-word limit.
          firstSeenDate: next.box > 0 ? today : null,
        })
        .onConflictDoUpdate({
          target: [progress.userId, progress.wordId],
          set: {
            box: next.box,
            dueAt: next.dueAt,
            seen: sql`${progress.seen} + 1`,
            correct: sql`${progress.correct} + ${check.correct ? 1 : 0}`,
            wrong: sql`${progress.wrong} + ${check.correct ? 0 : 1}`,
            lastSeenAt: now,
            ...(next.box > 0 ? { firstSeenDate: sql`coalesce(${progress.firstSeenDate}, ${today})` } : {}),
          },
        }),
      db.insert(attempts).values({
        userId,
        wordId: word.id,
        mode: payload.mode,
        typed,
        chosenArticle: chosen,
        correctArticle: word.article,
        articleOk: check.articleOk,
        lemmaOk: check.lemmaOk,
        createdAt: now,
      }),
      db
        .insert(dailyStats)
        .values({ userId, date: today, attempts: 1, correct: check.correct ? 1 : 0 })
        .onConflictDoUpdate({
          target: [dailyStats.userId, dailyStats.date],
          set: {
            attempts: sql`${dailyStats.attempts} + 1`,
            correct: sql`${dailyStats.correct} + ${check.correct ? 1 : 0}`,
          },
        }),
    ])

    return c.json({
      ...check,
      answer: {
        article: word.article,
        lemma: word.lemma,
        translation: word.translation,
        plural: word.plural,
        example: word.example,
      },
      hint: check.articleOk ? null : hintFor(word.lemma, word.article),
      box: next.box,
      dueAt: next.dueAt,
    })
  })
