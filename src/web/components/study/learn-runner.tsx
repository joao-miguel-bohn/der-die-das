import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { hintFor } from '@shared/hints'
import { ArticleBadge } from '@/components/article-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import type { LearnWord, Rating } from '@/lib/types'

const MAX_ROUNDS = 3

interface LearnEntry {
  word: LearnWord
  rating: Rating
}

export function LearnRunner({ items, onExit }: { items: LearnWord[]; onExit: () => void }) {
  const queryClient = useQueryClient()
  const [queue, setQueue] = useState<LearnWord[]>(() => [...items])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'front' | 'back'>('front')
  const [entries, setEntries] = useState<LearnEntry[]>([])
  const [roundCounts] = useState(() => new Map<number, number>())
  const finished = index >= queue.length
  const word = queue[index]
  const completed = new Set(entries.filter((e) => e.rating !== 'again').map((e) => e.word.id)).size

  const answer = useMutation({
    mutationFn: (body: { mode: 'learn'; wordId: number; rating: Rating }) =>
      api.post<{ recorded: true }>('/study/answer', body),
    onError: (e) => toast.error(`Could not save: ${e.message}`),
  })

  const rate = useCallback(
    (rating: Rating) => {
      if (!word) return
      const count = (roundCounts.get(word.id) ?? 0) + 1
      roundCounts.set(word.id, count)

      answer.mutate({ mode: 'learn', wordId: word.id, rating })
      setEntries((prev) => [...prev, { word, rating }])

      if (rating === 'again' && count < MAX_ROUNDS) {
        setQueue((prev) => [...prev, word])
      }

      setIndex((i) => i + 1)
      setPhase('front')
    },
    [word, answer, roundCounts],
  )

  useEffect(() => {
    if (finished) {
      for (const key of ['overview', 'trend', 'confusion', 'hardest', 'words']) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
    }
  }, [finished, queryClient])

  useEffect(() => {
    if (finished) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (phase === 'front' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setPhase('back')
      }
      if (phase === 'back') {
        if (e.key === '1') rate('again')
        if (e.key === '2') rate('good')
        if (e.key === '3') rate('easy')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, finished, rate])

  if (finished) {
    return <LearnSummary entries={entries} items={items} onExit={onExit} />
  }
  if (!word) return null

  const hint = hintFor(word.lemma, word.article)

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Progress value={(completed / items.length) * 100} className="flex-1" />
        <span>
          {completed} / {items.length}
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
          {phase === 'front' ? (
            <>
              <CardTitle className="pt-2 text-3xl">{word.lemma}</CardTitle>
              <CardDescription className="text-base">{word.translation}</CardDescription>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 pt-2">
                <ArticleBadge article={word.article} className="text-2xl px-3 py-1" />
                <span className="text-3xl font-bold">{word.lemma}</span>
              </div>
              <CardDescription className="text-base">{word.translation}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === 'front' ? (
            <Button autoFocus className="w-full h-14 text-lg" onClick={() => setPhase('back')}>
              Reveal
              <span className="ml-2 text-xs font-normal opacity-60">Space</span>
            </Button>
          ) : (
            <>
              <div className="space-y-1.5 rounded-lg border p-4 text-sm">
                {hint && (
                  <p>
                    <span className="font-medium">Tip:</span> {hint.text}
                  </p>
                )}
                {word.plural && <p className="text-muted-foreground">Plural: die {word.plural}</p>}
                {word.example && <p className="italic text-muted-foreground">{word.example}</p>}
                {!hint && !word.plural && !word.example && (
                  <p className="text-muted-foreground">No additional hints for this word.</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-0 border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  onClick={() => rate('again')}
                >
                  Again
                  <span className="text-xs font-normal text-muted-foreground">1</span>
                </Button>
                <Button
                  autoFocus
                  variant="outline"
                  className="h-14 flex-col gap-0 border-blue-300 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40"
                  onClick={() => rate('good')}
                >
                  Good
                  <span className="text-xs font-normal text-muted-foreground">2</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-0 border-green-300 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950/40"
                  onClick={() => rate('easy')}
                >
                  Easy
                  <span className="text-xs font-normal text-muted-foreground">3</span>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LearnSummary({ entries, items, onExit }: { entries: LearnEntry[]; items: LearnWord[]; onExit: () => void }) {
  const remembered = new Set(
    entries
      .filter((e) => e.rating !== 'again')
      .map((e) => e.word.id),
  )
  const needsPractice = items.filter((w) => !remembered.has(w.id))

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {items.length ? `${remembered.size} / ${items.length} remembered` : 'Session ended'}
        </CardTitle>
        {needsPractice.length > 0 && (
          <CardDescription>{needsPractice.length} still need practice</CardDescription>
        )}
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
