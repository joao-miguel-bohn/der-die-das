import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { hintFor } from '@shared/hints'
import { ARTICLES, type Article } from '@shared/types'
import { ArticleBadge } from '@/components/article-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import type { AnswerBody, LearnWord } from '@/lib/types'

const MAX_ROUNDS = 3

interface LearnEntry {
  word: LearnWord
  correct: boolean
}

export function LearnRunner({ items, onExit }: { items: LearnWord[]; onExit: () => void }) {
  const queryClient = useQueryClient()
  const [queue, setQueue] = useState<LearnWord[]>(() => [...items])
  const [index, setIndex] = useState(0)
  // undefined = not answered yet, null = "I don't know"
  const [guess, setGuess] = useState<Article | null | undefined>(undefined)
  const [entries, setEntries] = useState<LearnEntry[]>([])
  const rounds = useRef(new Map<number, number>())
  const finished = index >= queue.length
  const word = queue[index]
  const known = new Set(entries.filter((e) => e.correct).map((e) => e.word.id)).size

  const answer = useMutation({
    mutationFn: (body: AnswerBody) => api.post<{ recorded: true }>('/study/answer', body),
    onSuccess: () => {
      for (const key of ['overview', 'confusion', 'hardest', 'words']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: (e) => toast.error(`Could not save: ${e.message}`),
  })

  const submit = useCallback(
    (chosen: Article | null) => {
      if (!word || guess !== undefined) return
      const correct = chosen === word.article
      const count = (rounds.current.get(word.id) ?? 0) + 1
      rounds.current.set(word.id, count)

      answer.mutate({ mode: 'learn', wordId: word.id, chosenArticle: chosen })
      setGuess(chosen)
      setEntries((prev) => [...prev, { word, correct }])
      if (!correct && count < MAX_ROUNDS) setQueue((prev) => [...prev, word])
    },
    [word, guess, answer],
  )

  const next = useCallback(() => {
    setGuess(undefined)
    setIndex((i) => i + 1)
  }, [])

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if (guess === undefined) {
        const article = ARTICLES[Number(e.key) - 1]
        if (article) submit(article)
        else if (e.key === ' ') {
          e.preventDefault()
          submit(null)
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, guess, submit, next])

  if (finished) {
    return <LearnSummary entries={entries} items={items} onExit={onExit} />
  }
  if (!word) return null

  const answered = guess !== undefined
  const hint = hintFor(word.lemma, word.article)

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Progress value={(known / items.length) * 100} className="flex-1" />
        <span>
          {known} / {items.length}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit}>
          End
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center gap-2">
            <Badge variant="outline">{word.level}</Badge>
            <Badge variant="secondary">{word.kind === 'new' ? 'new' : 'review'}</Badge>
          </div>
          {answered ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              <ArticleBadge article={word.article} className="px-3 py-1 text-2xl" />
              <span className="text-3xl font-bold">{word.lemma}</span>
            </div>
          ) : (
            <CardTitle className="pt-2 text-3xl">{word.lemma}</CardTitle>
          )}
          <CardDescription className="text-base">{word.translation}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {answered ? (
            <>
              <GuessResult guess={guess} article={word.article} />
              <div className="space-y-1.5 rounded-lg border p-4 text-sm">
                {hint && (
                  <p>
                    <span className="font-medium">Tip:</span> {hint.text}
                  </p>
                )}
                {word.plural && <p className="text-muted-foreground">Plural: die {word.plural}</p>}
                {word.example && <p className="italic text-muted-foreground">{word.example}</p>}
                {!hint && !word.plural && !word.example && (
                  <p className="text-muted-foreground">Say it out loud once: “{word.article} {word.lemma}”.</p>
                )}
              </div>
              <Button autoFocus className="w-full" onClick={next}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {ARTICLES.map((a, i) => (
                  <Button key={a} variant="outline" className="h-16 flex-col gap-0 text-xl" onClick={() => submit(a)}>
                    {a}
                    <span className="text-xs font-normal text-muted-foreground">{i + 1}</span>
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => submit(null)}>
                I don't know
                <span className="ml-2 text-xs font-normal text-muted-foreground">Space</span>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GuessResult({ guess, article }: { guess: Article | null; article: Article }) {
  if (guess === article) {
    return (
      <p className="flex items-center justify-center gap-2 font-medium text-green-700 dark:text-green-400">
        <Check className="size-5" /> Right!
      </p>
    )
  }
  if (guess === null) {
    return <p className="text-center text-muted-foreground">Now you know — it comes back later in this session.</p>
  }
  return (
    <p className="flex items-center justify-center gap-2 font-medium text-red-700 dark:text-red-400">
      <X className="size-5" /> You guessed <ArticleBadge article={guess} />, but it's <ArticleBadge article={article} />
    </p>
  )
}

function LearnSummary({ entries, items, onExit }: { entries: LearnEntry[]; items: LearnWord[]; onExit: () => void }) {
  const lastResult = new Map(entries.map((e) => [e.word.id, e.correct]))
  const knownCount = items.filter((w) => lastResult.get(w.id)).length
  const needsPractice = items.filter((w) => lastResult.has(w.id) && !lastResult.get(w.id))

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {entries.length ? `${knownCount} / ${items.length} known` : 'Session ended'}
        </CardTitle>
        {needsPractice.length > 0 && <CardDescription>{needsPractice.length} still need practice</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {needsPractice.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Focus on these:</p>
            <ul className="space-y-1 text-sm">
              {needsPractice.map((w) => (
                <li key={w.id}>
                  <ArticleBadge article={w.article} /> {w.lemma}
                  <span className="text-muted-foreground"> — {w.translation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button className="w-full" onClick={onExit}>
          Done
        </Button>
      </CardContent>
    </Card>
  )
}
