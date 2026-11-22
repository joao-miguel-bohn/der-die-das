import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { type ComponentProps, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ARTICLES, type Article, type Mode } from '@shared/types'
import { whyThisWord } from '@shared/why'
import { ArticleBadge } from '@/components/article-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { percent } from '@/lib/article'
import type { AnswerBody, AnswerResult, SameMeaningResult, StudyWord } from '@/lib/types'
import { CardMeta } from './card-meta'
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
  // Type it: the last answer was a different word with the same meaning.
  const [sameMeaning, setSameMeaning] = useState<SameMeaningResult['sameMeaning'] | null>(null)
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
    mutationFn: (body: AnswerBody) => api.post<AnswerResult | SameMeaningResult>('/study/answer', body),
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
          if ('sameMeaning' in result) {
            setSameMeaning(result.sameMeaning)
            return
          }
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
    setSameMeaning(null)
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
    <div data-study-session className="mx-auto max-w-lg space-y-2 sm:space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Progress value={(index / items.length) * 100} className="flex-1" />
        <span className="tabular-nums">{index + 1} / {items.length}</span>
        {mode === 'sprint' && <span className="tabular-nums">{elapsed}s</span>}
        <Button variant="ghost" size="sm" onClick={onExit}>End</Button>
      </div>

      <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
        <CardHeader className="text-center">
          <CardMeta level={word.level} kind={word.kind === 'practice' ? null : word.kind === 'new' ? 'new' : word.kind === 'ahead' ? 'early' : 'review'}>
            {whyThisWord(mode, word.kind, word.history)}
          </CardMeta>
          {word.lemma ? (
            <>
              <CardTitle className="pt-1 text-3xl">{word.lemma}</CardTitle>
              <CardDescription className="text-base">{word.translation}</CardDescription>
            </>
          ) : (
            <>
              <CardDescription className="pt-1">Type the article and the German word</CardDescription>
              <CardTitle className="text-3xl">{word.translation}</CardTitle>
              {!!word.sameMeaning && (
                <CardDescription>
                  {word.sameMeaning === 1 ? '1 other word means this too' : `${word.sameMeaning} other words mean this too`}
                </CardDescription>
              )}
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === 'type' ? (
            <TypeInput
              key={word.id}
              wordId={word.id}
              entry={current}
              sameMeaning={sameMeaning}
              translation={word.translation}
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

function TypeInput({ wordId, entry, sameMeaning, translation, pending, onSubmit, onNext }: {
  wordId: number
  entry: Entry | null
  sameMeaning: SameMeaningResult['sameMeaning'] | null
  translation: string
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
  // A same-meaning answer isn't the one on the card: clear it for another try.
  const [answeredSameMeaning, setAnsweredSameMeaning] = useState(sameMeaning)
  if (sameMeaning !== answeredSameMeaning) {
    setAnsweredSameMeaning(sameMeaning)
    if (sameMeaning) setValue('')
  }
  useEffect(() => {
    if (sameMeaning) inputRef.current?.focus()
  }, [sameMeaning])

  const canCheck = !pending && !!value.trim()
  const canPeek = !pending && !peekMore.isPending && !allShown
  const check = () => { if (canCheck) onSubmit(value, peek !== null) }
  const giveUp = () => { if (!pending) onSubmit('', peek !== null) }
  const showLetter = () => { if (canPeek) peekMore.mutate() }

  // Keys 1 / 2 / 3, even while typing: answers never contain digits. Re-bound each render to see the latest value.
  useEffect(() => {
    if (entry) return
    const actions: Record<string, () => void> = { 1: check, 2: giveUp, 3: showLetter }
    const onKey = (e: KeyboardEvent) => {
      const action = actions[e.key]
      if (!action || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!entry) {
    return (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); check() }}>
        {sameMeaning && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-sm dark:border-amber-900 dark:bg-amber-950/40">
            {sameMeaning.articleOk ? <Check className="mr-1 inline size-4 text-green-600" /> : null}
            <ArticleBadge article={sameMeaning.article} /> <span className="font-medium">{sameMeaning.lemma}</span> also means
            "{translation}"{sameMeaning.articleOk ? '' : ` (note the article: ${sameMeaning.article})`}, but this card is for a
            different word. Try again.
          </p>
        )}
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
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          lang="de"
          placeholder="e.g. das Haus"
          className="h-12 text-center text-lg"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
        />
        {/* Buttons keep focus in the field, so the phone keyboard stays open and the card doesn't jump. */}
        <div className="grid grid-cols-3 gap-2" onMouseDown={(e) => e.preventDefault()}>
          <ActionButton type="submit" shortcut={1} disabled={!canCheck}>Check</ActionButton>
          <ActionButton variant="outline" shortcut={2} disabled={pending} onClick={giveUp}>
            <span className="sm:hidden">Don't know</span>
            <span className="hidden sm:inline">I don't know</span>
          </ActionButton>
          <ActionButton variant="outline" shortcut={3} disabled={!canPeek} onClick={showLetter}>
            <span className="sm:hidden">{peek ? '+1 letter' : 'A letter'}</span>
            <span className="hidden sm:inline">{peek ? 'Another letter' : 'Show a letter'}</span>
          </ActionButton>
        </div>
      </form>
    )
  }
  return (
    <div className="space-y-3">
      <Feedback result={entry.result} typed={entry.typed} />
      {entry.result.correct && (entry.word.kind === 'ahead' || entry.peeked) && (
        <p className="text-center text-sm text-muted-foreground">
          {entry.word.kind === 'ahead'
            ? 'Not due yet, so this word keeps its schedule.'
            : 'You used a hint, so this word stays in its box and comes back sooner.'}
        </p>
      )}
      {entry.result.correct ? (
        <Button autoFocus className="w-full" onClick={onNext}>Continue</Button>
      ) : (
        <RetypeField expected={`${entry.result.answer.article} ${entry.result.answer.lemma}`} onNext={onNext} />
      )}
    </div>
  )
}

/** A Type it action: tall enough to tap, with its key shown where there's a keyboard. */
function ActionButton({ shortcut, children, ...props }: ComponentProps<typeof Button> & { shortcut: number }) {
  return (
    <Button type="button" size="lg" className="h-11 min-w-0 px-2 sm:h-9" {...props}>
      <span className="truncate">{children}</span>
      <kbd className="hidden font-sans text-xs font-normal opacity-60 pointer-fine:inline">{shortcut}</kbd>
    </Button>
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
