export const ARTICLES = ['der', 'die', 'das'] as const
export type Article = (typeof ARTICLES)[number]

export const LEVELS = ['A1', 'A2', 'B1'] as const
export type Level = (typeof LEVELS)[number]

export const MODES = ['type', 'pick', 'sprint', 'learn'] as const
export type Mode = (typeof MODES)[number]

export type WordStatus = 'new' | 'learning' | 'mastered'
