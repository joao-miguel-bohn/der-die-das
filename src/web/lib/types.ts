import type { Article, Level, WordStatus } from '@shared/types'
import type { Hint } from '@shared/hints'

export interface Me { userId: string; email: string; isAdmin: boolean }

export interface StudyWord {
  id: number
  translation: string
  level: Level
  lemma?: string
  kind: 'due' | 'new' | 'ahead' | 'practice'
}

export interface LearnWord {
  id: number
  lemma: string
  translation: string
  level: Level
  article: Article
  plural: string | null
  example: string | null
  kind: 'new' | 'practice'
}

export interface AnswerResult {
  articleOk: boolean
  lemmaOk: boolean
  correct: boolean
  capitalizationOnly: boolean
  answer: { article: Article; lemma: string; translation: string; plural: string | null; example: string | null }
  hint: Hint | null
  box: number
  dueAt: number
}

export type AnswerBody =
  | { mode: 'type'; wordId: number; typed: string; peeked?: boolean }
  | { mode: 'pick' | 'sprint' | 'learn'; wordId: number; chosenArticle: Article | null }

export interface Overview {
  levels: { level: Level; total: number; fresh: number; learning: number; mastered: number }[]
  totals: { total: number; fresh: number; learning: number; mastered: number }
  dueNow: number
  readyToType: number
  streak: number
  today: { attempts: number; correct: number }
  accuracy: { attempts: number; article: number | null; lemma: number | null }
}

export interface TrendPoint { date: string; attempts: number; correct: number; accuracy: number | null }
export interface ConfusionCell { correct: Article; chosen: string; n: number }
export interface HardWord {
  id: number; article: Article; lemma: string; translation: string; level: Level; seen: number; wrong: number
}
export interface WordRow {
  id: number; article: Article; lemma: string; translation: string; level: Level
  plural: string | null; example: string | null
  box: number; status: WordStatus; seen: number; correct: number; wrong: number
}
export interface WordsPage { total: number; page: number; pageSize: number; items: WordRow[] }
