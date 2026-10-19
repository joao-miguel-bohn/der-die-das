import { z } from 'zod'
import { ARTICLES, LEVELS, MODES } from './types'

export const articleSchema = z.enum(ARTICLES)
export const levelSchema = z.enum(LEVELS)
export const modeSchema = z.enum(MODES)

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === '' ? undefined : v))
  .optional()

export const importRowSchema = z.object({
  article: articleSchema,
  lemma: z.string().trim().min(1).max(100),
  translation: z.string().trim().min(1).max(300),
  level: levelSchema,
  plural: optionalText,
  example: optionalText,
})
export type ImportRow = z.infer<typeof importRowSchema>

export const importPayloadSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
})

export const answerPayloadSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('type'), wordId: z.number().int().positive(), typed: z.string().max(200) }),
  z.object({ mode: z.literal('pick'), wordId: z.number().int().positive(), chosenArticle: articleSchema.nullable() }),
  z.object({ mode: z.literal('sprint'), wordId: z.number().int().positive(), chosenArticle: articleSchema.nullable() }),
  z.object({ mode: z.literal('learn'), wordId: z.number().int().positive(), chosenArticle: articleSchema.nullable() }),
])
export type AnswerPayload = z.infer<typeof answerPayloadSchema>

export const sessionQuerySchema = z.object({
  mode: modeSchema.default('type'),
  level: levelSchema.optional(),
  size: z.coerce.number().int().min(1).max(50).default(20),
})

export const settingsSchema = z.object({
  dailyNewLimit: z.number().int().min(0).max(100),
})

const wordIdList = z.array(z.number().int().positive()).min(1).max(500)

export const deleteWordsSchema = z.object({ ids: wordIdList })

/** Resetting everything must be asked for explicitly; an empty body never wipes anything. */
export const resetProgressSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('all') }),
  z.object({ scope: z.literal('words'), wordIds: wordIdList }),
])
export type ResetProgressPayload = z.infer<typeof resetProgressSchema>
