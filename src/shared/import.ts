import { importRowSchema, type ImportRow } from './schemas'
import { ARTICLES } from './types'

export interface ParseError {
  /** 1-based row number in the source (header excluded for CSV). */
  row: number
  message: string
}

export interface ParseResult {
  rows: ImportRow[]
  errors: ParseError[]
}

const HEADER_ALIASES: Record<string, string> = {
  article: 'article', artikel: 'article',
  word: 'lemma', lemma: 'lemma', wort: 'lemma', german: 'lemma', deutsch: 'lemma', noun: 'lemma',
  translation: 'translation', english: 'translation', en: 'translation', meaning: 'translation',
  portuguese: 'translation', pt: 'translation', übersetzung: 'translation', uebersetzung: 'translation',
  level: 'level', niveau: 'level',
  plural: 'plural',
  example: 'example', beispiel: 'example', sentence: 'example',
}

function detectDelimiter(headerLine: string): string {
  const counts = [',', ';', '\t'].map((d) => [d, headerLine.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0]![1] > 0 ? counts[0]![0] : ','
}

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, newlines inside quotes). */
export function parseCsvText(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

/** "das Haus" in the word column -> article + lemma, when no article column is given. */
function splitArticle(record: Record<string, string>): Record<string, string> {
  const lemma = (record.lemma ?? '').trim()
  const [first = '', ...rest] = lemma.split(/\s+/)
  if (!record.article?.trim() && (ARTICLES as readonly string[]).includes(first.toLowerCase()) && rest.length) {
    return { ...record, article: first, lemma: rest.join(' ') }
  }
  return record
}

function validate(records: Record<string, string>[]): ParseResult {
  const rows: ImportRow[] = []
  const errors: ParseError[] = []
  const seen = new Set<string>()
  records.forEach((raw, index) => {
    const record = splitArticle(raw)
    const parsed = importRowSchema.safeParse({
      ...record,
      article: record.article?.trim().toLowerCase(),
      level: record.level?.trim().toUpperCase(),
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      errors.push({ row: index + 1, message: `${issue?.path.join('.') || 'row'}: ${issue?.message ?? 'invalid'}` })
      return
    }
    const key = `${parsed.data.article} ${parsed.data.lemma}`
    if (seen.has(key)) {
      errors.push({ row: index + 1, message: `duplicate of an earlier row (${key})` })
      return
    }
    seen.add(key)
    rows.push(parsed.data)
  })
  return { rows, errors }
}

export function parseCsv(text: string): ParseResult {
  const clean = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? '')
  const [header, ...body] = parseCsvText(clean, delimiter)
  if (!header) return { rows: [], errors: [{ row: 0, message: 'file is empty' }] }
  const columns = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? '')
  if (!columns.includes('lemma') || !columns.includes('translation') || !columns.includes('level')) {
    return { rows: [], errors: [{ row: 0, message: 'header must contain word, translation and level (article optional if the word starts with der/die/das)' }] }
  }
  const records = body.map((cells) => {
    const record: Record<string, string> = {}
    columns.forEach((col, i) => { if (col) record[col] = cells[i] ?? '' })
    return record
  })
  return validate(records)
}

export function parseJson(text: string): ParseResult {
  let data: unknown
  try { data = JSON.parse(text) } catch { return { rows: [], errors: [{ row: 0, message: 'invalid JSON' }] } }
  if (!Array.isArray(data)) return { rows: [], errors: [{ row: 0, message: 'JSON must be an array of objects' }] }
  const records = data.map((item) => {
    const record: Record<string, string> = {}
    if (item && typeof item === 'object') {
      for (const [key, value] of Object.entries(item)) {
        const col = HEADER_ALIASES[key.trim().toLowerCase()]
        if (col && value != null) record[col] = String(value)
      }
    }
    return record
  })
  return validate(records)
}

export function parseImportFile(filename: string, text: string): ParseResult {
  return filename.toLowerCase().endsWith('.json') ? parseJson(text) : parseCsv(text)
}
