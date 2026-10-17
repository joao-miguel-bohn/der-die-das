import { ARTICLES, type Article } from './types'

export interface ParsedAnswer {
  article: Article | null
  lemma: string
}

export interface CheckResult {
  articleOk: boolean
  lemmaOk: boolean
  correct: boolean
  /** The lemma is right except for upper/lower case (nouns are capitalised in German). */
  capitalizationOnly: boolean
}

export function normalizeSpaces(input: string): string {
  return input.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function parseTyped(input: string): ParsedAnswer {
  const text = normalizeSpaces(input)
  const [first = '', ...rest] = text.split(' ')
  const candidate = first.toLowerCase()
  if ((ARTICLES as readonly string[]).includes(candidate)) {
    return { article: candidate as Article, lemma: rest.join(' ') }
  }
  return { article: null, lemma: text }
}

/** ae/oe/ue/ss are accepted for ä/ö/ü/ß (keyboards without umlauts). */
function fold(s: string): string {
  return s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
}

export function lemmasMatch(typed: string, expected: string): boolean {
  return typed === expected || fold(typed) === fold(expected)
}

export function checkTyped(input: string, word: { article: Article; lemma: string }): CheckResult {
  const parsed = parseTyped(input)
  const articleOk = parsed.article === word.article
  const lemmaOk = lemmasMatch(parsed.lemma, word.lemma)
  const capitalizationOnly =
    !lemmaOk && parsed.lemma !== '' && lemmasMatch(parsed.lemma.toLowerCase(), word.lemma.toLowerCase())
  return { articleOk, lemmaOk, correct: articleOk && lemmaOk, capitalizationOnly }
}

/** Article-only exercise: the lemma is shown, so it is always "ok". */
export function checkPick(chosen: Article, word: { article: Article }): CheckResult {
  const articleOk = chosen === word.article
  return { articleOk, lemmaOk: true, correct: articleOk, capitalizationOnly: false }
}
