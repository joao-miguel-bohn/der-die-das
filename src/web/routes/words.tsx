import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LEVELS } from '@shared/types'
import { ArticleBadge } from '@/components/article-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import type { WordRow, WordsPage } from '@/lib/types'

const ALL = 'all'

interface PendingAction {
  kind: 'reset' | 'delete'
  words: WordRow[]
}

const plural = (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`

export default function Words() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const isAdmin = me?.isAdmin ?? false

  const [level, setLevel] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<PendingAction | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page) })
  if (level !== ALL) params.set('level', level)
  if (status !== ALL) params.set('status', status)
  if (q) params.set('q', q)
  const key = params.toString()

  // The selection belongs to the page/filters it was made on, so it is dropped when they change.
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<number> }>({ key, ids: new Set() })
  const selectedIds = selection.key === key ? selection.ids : new Set<number>()

  const { data, isFetching } = useQuery({
    queryKey: ['words', key],
    queryFn: () => api.get<WordsPage>(`/words?${params}`),
    placeholderData: (prev) => prev,
  })
  const items = data?.items ?? []
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const selectedItems = items.filter((w) => selectedIds.has(w.id))
  const allSelected = items.length > 0 && selectedItems.length === items.length

  const setSelected = (ids: Set<number>) => setSelection({ key, ids })
  const toggle = (id: number, on: boolean) => {
    const next = new Set(selectedIds)
    if (on) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  const run = useMutation({
    mutationFn: async ({ kind, words }: PendingAction) => {
      const ids = words.map((w) => w.id)
      if (kind === 'delete') return api.post<{ deleted: number }>('/words/delete', { ids })
      return api.post<{ wordsReset: number }>('/progress/reset', { scope: 'words', wordIds: ids })
    },
    onSuccess: (_result, { kind, words }) => {
      toast.success(kind === 'delete' ? `Deleted ${plural(words.length)}` : `Reset progress for ${plural(words.length)}`)
      setAction(null)
      setSelected(new Set())
      void queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input className="w-full sm:w-64" placeholder="Search word or meaning…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1) }}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All levels</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            <SelectItem value="new">Not started</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
            <SelectItem value="mastered">Mastered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{selectedItems.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'reset', words: selectedItems })}>
            <RotateCcw /> Reset progress
          </Button>
          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={() => setAction({ kind: 'delete', words: selectedItems })}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <Table className={isFetching ? 'opacity-70' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                aria-label="Select all words on this page"
                checked={allSelected ? true : selectedItems.length > 0 ? 'indeterminate' : false}
                disabled={items.length === 0}
                onCheckedChange={(on) => setSelected(on === true ? new Set(items.map((w) => w.id)) : new Set())}
              />
            </TableHead>
            <TableHead>Word</TableHead>
            <TableHead className="hidden sm:table-cell">Meaning</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="w-8"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((w) => (
            <TableRow key={w.id} data-state={selectedIds.has(w.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${w.article} ${w.lemma}`}
                  checked={selectedIds.has(w.id)}
                  onCheckedChange={(on) => toggle(w.id, on === true)}
                />
              </TableCell>
              <TableCell><ArticleBadge article={w.article} /> {w.lemma}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{w.translation}</TableCell>
              <TableCell>{w.level}</TableCell>
              <TableCell>
                <Badge variant={w.status === 'mastered' ? 'default' : w.status === 'learning' ? 'secondary' : 'outline'}>
                  {w.status === 'new' ? 'not started' : w.status === 'learning' ? `box ${w.box}` : 'mastered'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{w.seen ? `${w.wrong}/${w.seen}` : '–'}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${w.lemma}`}><MoreHorizontal /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={w.seen === 0} onSelect={() => setAction({ kind: 'reset', words: [w] })}>
                      <RotateCcw /> Reset progress
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: 'delete', words: [w] })}>
                        <Trash2 /> Delete word
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {data && items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No words match.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} words</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        pending={run.isPending}
        title={action?.kind === 'delete' ? `Delete ${plural(action.words.length)}?` : `Reset progress for ${plural(action?.words.length ?? 0)}?`}
        confirmLabel={action?.kind === 'delete' ? 'Delete' : 'Reset progress'}
        onConfirm={() => action && run.mutate(action)}
        description={
          action?.kind === 'delete'
            ? 'This removes the words from the shared vocabulary for everyone, together with every user’s progress and answer history on them. It cannot be undone; you would have to import them again.'
            : 'Your box, error count and answer history for these words are erased and they count as new again. Daily totals, streak and other words are not affected.'
        }
      >
        {action && (
          <ul className="max-h-40 space-y-1 overflow-auto rounded-md border p-3 text-sm">
            {action.words.slice(0, 20).map((w) => (
              <li key={w.id}><ArticleBadge article={w.article} /> {w.lemma} <span className="text-muted-foreground">— {w.translation}</span></li>
            ))}
            {action.words.length > 20 && <li className="text-muted-foreground">…and {action.words.length - 20} more</li>}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  )
}
