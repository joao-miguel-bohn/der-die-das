import type { Article } from './types'

interface Rule {
  /** Matches when the lowercase lemma ends with one of these. */
  suffixes?: string[]
  /** Matches when the lowercase lemma is exactly one of these. */
  exact?: string[]
  article: Article
  label: string
  /** "always" rules have virtually no exceptions. */
  strength: 'always' | 'usually'
}

const RULES: Rule[] = [
  { exact: ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'], article: 'der', label: 'Days of the week', strength: 'always' },
  { exact: ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'], article: 'der', label: 'Months', strength: 'always' },
  { exact: ['frühling', 'sommer', 'herbst', 'winter'], article: 'der', label: 'Seasons', strength: 'always' },
  { exact: ['norden', 'süden', 'osten', 'westen'], article: 'der', label: 'Compass directions', strength: 'always' },
  { suffixes: ['chen', 'lein'], article: 'das', label: 'Diminutives (-chen, -lein)', strength: 'always' },
  { suffixes: ['ung'], article: 'die', label: 'Nouns ending in -ung', strength: 'always' },
  { suffixes: ['heit', 'keit'], article: 'die', label: 'Nouns ending in -heit / -keit', strength: 'always' },
  { suffixes: ['schaft'], article: 'die', label: 'Nouns ending in -schaft', strength: 'always' },
  { suffixes: ['ion'], article: 'die', label: 'Nouns ending in -ion', strength: 'always' },
  { suffixes: ['tät'], article: 'die', label: 'Nouns ending in -tät', strength: 'always' },
  { suffixes: ['ik'], article: 'die', label: 'Nouns ending in -ik', strength: 'usually' },
  { suffixes: ['ur'], article: 'die', label: 'Nouns ending in -ur', strength: 'usually' },
  { suffixes: ['enz', 'anz'], article: 'die', label: 'Nouns ending in -enz / -anz', strength: 'usually' },
  { suffixes: ['ei'], article: 'die', label: 'Nouns ending in -ei', strength: 'usually' },
  { suffixes: ['ismus'], article: 'der', label: 'Nouns ending in -ismus', strength: 'always' },
  { suffixes: ['ling'], article: 'der', label: 'Nouns ending in -ling', strength: 'always' },
  { suffixes: ['ist', 'ant', 'eur'], article: 'der', label: 'Nouns ending in -ist / -ant / -eur (people)', strength: 'usually' },
  { suffixes: ['ment', 'ium', 'eum'], article: 'das', label: 'Nouns ending in -ment / -ium / -eum', strength: 'usually' },
  { suffixes: ['nis'], article: 'das', label: 'Nouns ending in -nis', strength: 'usually' },
  { suffixes: ['e'], article: 'die', label: 'Nouns ending in -e', strength: 'usually' },
]

export interface Hint {
  /** The article the rule predicts. */
  predicts: Article
  /** Human-readable explanation. */
  text: string
  /** True when this word breaks the rule. */
  exception: boolean
}

export function hintFor(lemma: string, article: Article): Hint | null {
  const lower = lemma.toLowerCase()
  const rule = RULES.find(
    (r) => r.exact?.includes(lower) || r.suffixes?.some((s) => lower.endsWith(s)),
  )
  if (!rule) return null
  const exception = rule.article !== article
  const text = exception
    ? `${rule.label} are ${rule.strength === 'always' ? 'almost always' : 'usually'} ${rule.article} — but "${lemma}" is an exception: ${article}.`
    : `${rule.label} are ${rule.strength === 'always' ? 'almost always' : 'usually'} ${rule.article}.`
  return { predicts: rule.article, text, exception }
}
