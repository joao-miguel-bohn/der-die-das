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
