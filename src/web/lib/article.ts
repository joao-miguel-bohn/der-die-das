import type { Article } from '@shared/types'

/** Conventional gender colours: der = blue, die = red, das = green. */
export const ARTICLE_STYLES: Record<Article, string> = {
  der: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  die: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  das: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
}

export const percent = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`)
