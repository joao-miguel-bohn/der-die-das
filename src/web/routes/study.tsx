import { useMutation } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LEVELS, MODES, type Mode } from '@shared/types'
import { LearnRunner } from '@/components/study/learn-runner'
import { Runner } from '@/components/study/runner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import type { LearnWord, StudyWord } from '@/lib/types'

const MODE_INFO: Record<Mode, { label: string; size: number; description: string }> = {
  type: {
    label: 'Type it',
    size: 20,
    description: 'Spaced repetition. You see the meaning and type article + word (e.g. "das Haus"). Due words come first, then words you met in Learn.',
  },
  pick: {
    label: 'Pick article',
    size: 20,
    description: 'Drill der / die / das on words you met in Learn. Starts with the words you get wrong most often. Keys 1 / 2 / 3.',
  },
  sprint: {
    label: 'Sprint',
    size: 10,
    description: '10 random words you met in Learn, against the clock. Keys 1 / 2 / 3.',
  },
  learn: {
    label: 'Learn',
    size: 10,
    description: 'Guess the article first (keys 1 / 2 / 3, Space if you don\'t know), then see it with memory aids. Words you miss come back in the same session.',
  },
}

const ALL = 'all'
/** Modes that drill words you have already met in Learn. */
const PRACTICE_MODES = MODES.filter((m) => m !== 'learn')

export default function Study() {
  const [params] = useSearchParams()
  const requested = params.get('mode')
  const [mode, setMode] = useState<Mode>((MODES as readonly string[]).includes(requested ?? '') ? (requested as Mode) : 'type')
  const [level, setLevel] = useState(ALL)
  const [items, setItems] = useState<StudyWord[] | LearnWord[] | null>(null)
  const [round, setRound] = useState(0)
  // The selection whose Type it session came back empty, so the "practice ahead" offer shows only for it.
  const [emptyFor, setEmptyFor] = useState<string | null>(null)
  const selection = `${mode}:${level}`

  const start = useMutation({
    mutationFn: (ahead: boolean) => {
      const q = new URLSearchParams({ mode, size: String(MODE_INFO[mode].size) })
      if (level !== ALL) q.set('level', level)
      if (ahead) q.set('ahead', 'true')
      return api.get<{ items: StudyWord[] | LearnWord[] }>(`/study/session?${q}`)
    },
    onSuccess: (data, ahead) => {
      if (data.items.length === 0) {
        if (mode === 'type' && !ahead) {
          setEmptyFor(selection)
          return
        }
        toast.info(
          mode === 'learn'
            ? 'No words found for this selection.'
            : mode === 'type'
              ? 'No words in review yet. Learn some words first, then type them here.'
              : 'No words from Learn yet for this selection. Learn some words first, then practice them here.',
        )
        return
      }
      setEmptyFor(null)
      setItems(data.items)
      setRound((r) => r + 1)
    },
    onError: (e) => toast.error(e.message),
  })

  if (items) {
    if (mode === 'learn') {
      return <LearnRunner key={round} items={items as LearnWord[]} onExit={() => setItems(null)} />
    }
    return <Runner key={round} mode={mode} items={items as StudyWord[]} onExit={() => setItems(null)} />
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Study</CardTitle>
        <CardDescription>{MODE_INFO[mode].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          {/* Learn first, then practice: two groups make the order visible. Stacked on narrow screens. */}
          <TabsList className="flex w-full flex-col items-stretch gap-1 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:flex-row sm:items-start sm:gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex h-8 rounded-lg bg-muted p-[3px]">
                <TabsTrigger value="learn" className="px-4">{MODE_INFO.learn.label}</TabsTrigger>
              </div>
              <span className="text-center text-xs">Step 1</span>
            </div>
            <ChevronRight className="size-4 rotate-90 self-center sm:mt-2 sm:rotate-0 sm:self-start" aria-hidden />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex h-8 rounded-lg bg-muted p-[3px]">
                {PRACTICE_MODES.map((m) => <TabsTrigger key={m} value={m}>{MODE_INFO[m].label}</TabsTrigger>)}
              </div>
              <span className="text-center text-xs">Step 2 · Practice</span>
            </div>
          </TabsList>
        </Tabs>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All levels</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="w-full" size="lg" disabled={start.isPending} onClick={() => start.mutate(false)}>
          {start.isPending ? 'Loading…' : 'Start'}
        </Button>
        {mode === 'type' && emptyFor === selection && (
          <div className="space-y-3 rounded-lg border p-3 text-center text-sm">
            <p>
              Nothing due and no learned words waiting. Learn more words, or practice ahead: words that aren't due yet.
              Practicing ahead doesn't move them up a box.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('learn')}>Learn new words</Button>
              <Button className="flex-1" disabled={start.isPending} onClick={() => start.mutate(true)}>Practice ahead</Button>
            </div>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground">
          No words yet? <Link className="underline" to="/import">Import a list</Link>.
        </p>
      </CardContent>
    </Card>
  )
}
