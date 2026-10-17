import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { LEVELS } from '@shared/types'
import { ArticleBadge } from '@/components/article-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { WordsPage } from '@/lib/types'

const ALL = 'all'

export default function Words() {
  const [level, setLevel] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page) })
  if (level !== ALL) params.set('level', level)
  if (status !== ALL) params.set('status', status)
  if (q) params.set('q', q)

  const { data, isFetching } = useQuery({
    queryKey: ['words', params.toString()],
    queryFn: () => api.get<WordsPage>(`/words?${params}`),
    placeholderData: (prev) => prev,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

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

      <Table className={isFetching ? 'opacity-70' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>Word</TableHead>
            <TableHead className="hidden sm:table-cell">Meaning</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.map((w) => (
            <TableRow key={w.id}>
              <TableCell><ArticleBadge article={w.article} /> {w.lemma}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{w.translation}</TableCell>
              <TableCell>{w.level}</TableCell>
              <TableCell>
                <Badge variant={w.status === 'mastered' ? 'default' : w.status === 'learning' ? 'secondary' : 'outline'}>
                  {w.status === 'new' ? 'not started' : w.status === 'learning' ? `box ${w.box}` : 'mastered'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{w.seen ? `${w.wrong}/${w.seen}` : '–'}</TableCell>
            </TableRow>
          ))}
          {data && data.items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No words match.</TableCell></TableRow>
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
    </div>
  )
}
