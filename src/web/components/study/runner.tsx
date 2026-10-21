import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ARTICLES, type Article, type Mode } from '@shared/types'
import { ArticleBadge } from '@/components/article-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { percent } from '@/lib/article'
import type { AnswerBody, AnswerResult, StudyWord } from '@/lib/types'
import { Feedback } from './feedback'

interface Entry {
  word: StudyWord
  result: AnswerResult
  typed?: string
  chosen?: Article | null
  peeked?: boolean
}

const AUTO_ADVANCE_MS = 800

export function Runner({ mode, items, onExit }: { mode: Mode; items: StudyWord[]; onExit: () => void }) {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const [entries, setEntries] = useState<Entry[]>([])
  const [current, setCurrent] = useState<Entry | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const finished = index >= items.length
  const word = items[index]

  const refresh = useCallback(() => {
    for (const key of ['overview', 'trend', 'confusion', 'hardest', 'words']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }, [queryClient])

  useEffect(() => {
    if (finished) { refresh(); return }
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(t)
  }, [finished, refresh, startedAt])

  const answer = useMutation({
    mutationFn: (body: AnswerBody) => api.post<AnswerResult>('/study/answer', body),
    onError: (e) => toast.error(`Could not save answer: ${e.message}`),
  })

  const submit = useCallback(
    (extra: { typed: string; peeked: boolean } | { chosen: Article | null }) => {
      if (!word || current || answer.isPending) return
      const body: AnswerBody = 'typed' in extra
        ? { mode: 'type', wordId: word.id, typed: extra.typed, peeked: extra.peeked }
        : { mode: mode === 'sprint' ? 'sprint' : 'pick', wordId: word.id, chosenArticle: extra.chosen }
      answer.mutate(body, {
        onSuccess: (result) => {
          const entry: Entry = { word, result, ...('typed' in extra ? { typed: extra.typed, peeked: extra.peeked } : { chosen: extra.chosen }) }
          setCurrent(entry)
        },
      })
    },
    [word, current, answer, mode],
  )

  const next = useCallback(() => {
    if (current) setEntries((e) => [...e, current])
    setCurrent(null)
    setIndex((i) => i + 1)
  }, [current])

  // Article-only modes: a correct answer moves on by itself.
  useEffect(() => {
    if (mode === 'type' || !current?.result.correct) return
    const t = setTimeout(next, AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [current, mode, next])

  // Keyboard: 1/2/3 pick der/die/das.
  useEffect(() => {
    if (mode === 'type' || current || finished) return
    const onKey = (e: KeyboardEvent) => {
      const article = ARTICLES[Number(e.key) - 1]
      if (article) submit({ chosen: article })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, current, finished, submit])

  if (finished) {
    return <Summary mode={mode} entries={entries} seconds={elapsed} onExit={onExit} />
  }
  if (!word) return null

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Progress value={(index / items.length) * 100} className="flex-1" />
        <span>{index + 1} / {items.length}</span>
        {mode === 'sprint' && <span className="tabular-nums">{elapsed}s</span>}
        <Button variant="ghost" size="sm" onClick={onExit}>End</Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center gap-2">
            <Badge variant="outline">{word.level}</Badge>
            {word.kind !== 'practice' && <Badge variant="secondary">{word.kind === 'new' ? 'new' : 'review'}</Badge>}
          </div>
          {word.lemma ? (
            <>
              <CardTitle className="pt-2 text-3xl">{word.lemma}</CardTitle>
              <CardDescription className="text-base">{word.translation}</CardDescription>
            </>
          ) : (
            <>
              <CardDescription className="pt-2">Type the article and the German word</CardDescription>
              <CardTitle className="text-3xl">{word.translation}</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'type' ? (
            <TypeInput
              key={word.id}
              wordId={word.id}
              entry={current}
              pending={answer.isPending}
              onSubmit={(typed, peeked) => submit({ typed, peeked })}
              onNext={next}
            />
          ) : (
            <PickButtons
              entry={current}
              pending={answer.isPending}
              onPick={(chosen) => submit({ chosen })}
              onNext={next}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TypeInput({ wordId, entry, pending, onSubmit, onNext }: {
  wordId: number
  entry: Entry | null
  pending: boolean
  onSubmit: (typed: string, peeked: boolean) => void
  onNext: () => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Revealed start of the German word, e.g. "Sch____". Fetched so the session never carries the answer.
  const [peek, setPeek] = useState<{ masked: string; shown: number } | null>(null)
  const peekMore = useMutation({
    mutationFn: () => api.get<{ masked: string; shown: number }>(`/study/peek?wordId=${wordId}&letters=${(peek?.shown ?? 0) + 1}`),
    onSuccess: (p) => { setPeek(p); inputRef.current?.focus() },
    onError: (e) => toast.error(e.message),
  })
  const allShown = peek ? peek.shown >= Array.from(peek.masked).length - 1 : false
  if (!entry) {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value, peek !== null) }}>
        {peek && (
          <p className="text-center font-mono text-xl tracking-[0.3em]" aria-label={`Starts with ${peek.masked.slice(0, peek.shown)}`}>
            {peek.masked}
          </p>
        )}
        <Input
          ref={inputRef}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="e.g. das Haus"
          className="h-12 text-center text-lg"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={pending || !value.trim()}>Check</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onSubmit('', peek !== null)}>I don't know</Button>
        </div>
        <Button type="button" variant="ghost" className="w-full" disabled={pending || peekMore.isPending || allShown} onClick={() => peekMore.mutate()}>
          {peek ? 'Show another letter' : 'Show a letter'}
        </Button>
      </form>
    )
  }
  return (
    <div className="space-y-3">
      <Feedback result={entry.result} typed={entry.typed} />
      {entry.peeked && entry.result.correct && (
        <p className="text-center text-sm text-muted-foreground">You used a hint, so this word stays in its box and comes back sooner.</p>
      )}
      {entry.result.correct ? (
        <Button autoFocus className="w-full" onClick={onNext}>Continue</Button>
      ) : (
        <RetypeField expected={`${entry.result.answer.article} ${entry.result.answer.lemma}`} onNext={onNext} />
      )}
    </div>
  )
}

/** After a mistake, typing the right answer once helps it stick. Enter always continues. */
function RetypeField({ expected, onNext }: { expected: string; onNext: () => void }) {
  const [value, setValue] = useState('')
  const matches = value.trim() === expected
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); onNext() }}>
      <Input
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder={`Type "${expected}" once more, then Enter`}
        className={matches ? 'border-green-500' : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" variant={matches ? 'default' : 'outline'} className="w-full">Continue</Button>
    </form>
  )
}

function PickButtons({ entry, pending, onPick, onNext }: {
  entry: Entry | null
  pending: boolean
  onPick: (a: Article | null) => void
  onNext: () => void
}) {
  if (entry) {
    return (
      <div className="space-y-3">
        <Feedback result={entry.result} />
        {!entry.result.correct && <Button autoFocus className="w-full" onClick={onNext}>Continue</Button>}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {ARTICLES.map((a, i) => (
          <Button key={a} variant="outline" className="h-16 flex-col gap-0 text-xl" disabled={pending} onClick={() => onPick(a)}>
            {a}
            <span className="text-xs font-normal text-muted-foreground">{i + 1}</span>
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="w-full" disabled={pending} onClick={() => onPick(null)}>I don't know</Button>
    </div>
  )
}

function Summary({ mode, entries, seconds, onExit }: { mode: Mode; entries: Entry[]; seconds: number; onExit: () => void }) {
  const correct = entries.filter((e) => e.result.correct).length
  const articleOk = entries.filter((e) => e.result.articleOk).length
  const mistakes = entries.filter((e) => !e.result.correct)
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{entries.length ? `${correct} / ${entries.length} correct` : 'Session ended'}</CardTitle>
        {entries.length > 0 && (
          <CardDescription>
            Article accuracy {percent(articleOk / entries.length)}
            {mode === 'sprint' && ` · ${seconds}s (${(seconds / entries.length).toFixed(1)}s per word)`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {mistakes.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">To remember:</p>
            <ul className="space-y-1 text-sm">
              {mistakes.map((m) => (
                <li key={m.word.id}>
                  <ArticleBadge article={m.result.answer.article} /> {m.result.answer.lemma}
                  <span className="text-muted-foreground"> — {m.result.answer.translation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button className="w-full" onClick={onExit}>Done</Button>
      </CardContent>
    </Card>
  )
}
