import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LEVELS, MODES, type Mode } from '@shared/types'
import { Runner } from '@/components/study/runner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import type { StudyWord } from '@/lib/types'

const MODE_INFO: Record<Mode, { label: string; size: number; description: string }> = {
  type: {
    label: 'Type it',
    size: 20,
    description: 'Spaced repetition. You see the meaning and type article + word (e.g. "das Haus"). Due words come first, then new ones.',
  },
  pick: {
    label: 'Pick article',
    size: 20,
    description: 'Drill der / die / das on the word itself. Starts with the words you get wrong most often. Keys 1 / 2 / 3.',
  },
  sprint: {
    label: 'Sprint',
    size: 10,
    description: '10 random words against the clock. Keys 1 / 2 / 3.',
  },
}

const ALL = 'all'

export default function Study() {
  const [params] = useSearchParams()
  const requested = params.get('mode')
  const [mode, setMode] = useState<Mode>((MODES as readonly string[]).includes(requested ?? '') ? (requested as Mode) : 'type')
  const [level, setLevel] = useState(ALL)
  const [items, setItems] = useState<StudyWord[] | null>(null)
  const [round, setRound] = useState(0)

  const start = useMutation({
    mutationFn: () => {
      const q = new URLSearchParams({ mode, size: String(MODE_INFO[mode].size) })
      if (level !== ALL) q.set('level', level)
      return api.get<{ items: StudyWord[] }>(`/study/session?${q}`)
    },
    onSuccess: (data) => {
      if (data.items.length === 0) {
        toast.info(mode === 'type' ? 'Nothing due right now and no new words left today.' : 'No words found for this selection.')
        return
      }
      setItems(data.items)
      setRound((r) => r + 1)
    },
    onError: (e) => toast.error(e.message),
  })

  if (items) {
    return <Runner key={round} mode={mode} items={items} onExit={() => setItems(null)} />
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Study</CardTitle>
        <CardDescription>{MODE_INFO[mode].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            {MODES.map((m) => <TabsTrigger key={m} value={m}>{MODE_INFO[m].label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All levels</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="w-full" size="lg" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? 'Loading…' : 'Start'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No words yet? <Link className="underline" to="/import">Import a list</Link>.
        </p>
      </CardContent>
    </Card>
  )
}
