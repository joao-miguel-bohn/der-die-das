import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import { percent } from '@/lib/article'
import { formatDate, formatDateTime, timeAgo } from '@/lib/time'
import type { AdminUsersPage } from '@/lib/types'

type Sort = 'active' | 'joined'

export default function UsersPage() {
  const { data: me } = useMe()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('active')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams({ page: String(page), sort })
  if (q) params.set('q', q)
  const key = params.toString()

  const { data, isFetching } = useQuery({
    queryKey: ['admin-users', key],
    queryFn: () => api.get<AdminUsersPage>(`/admin/users?${params}`),
    placeholderData: (prev) => prev,
    enabled: me?.isAdmin === true,
  })

  if (me && !me.isAdmin) return <p className="text-muted-foreground">Only the admin can see users.</p>

  const items = data?.items ?? []
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const totalWords = data?.totalWords ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input className="w-full sm:w-64" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={sort} onValueChange={(v) => { setSort(v as Sort); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Last active</SelectItem>
            <SelectItem value="joined">Newest accounts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table className={isFetching ? 'opacity-70' : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead className="hidden sm:table-cell">Joined</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead className="w-48">Progress</TableHead>
            <TableHead className="hidden text-right md:table-cell">Accuracy</TableHead>
            <TableHead className="hidden text-right md:table-cell">Active days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell" title={formatDateTime(u.createdAt)}>{formatDate(u.createdAt)}</TableCell>
              <TableCell title={u.lastActiveAt ? formatDateTime(u.lastActiveAt) : undefined}>
                {u.lastActiveAt ? timeAgo(u.lastActiveAt) : <span className="text-muted-foreground">never</span>}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-green-500" style={{ width: `${totalWords ? (u.mastered / totalWords) * 100 : 0}%` }} />
                    <div className="bg-amber-400" style={{ width: `${totalWords ? (u.learning / totalWords) * 100 : 0}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.mastered} mastered · {u.learning} learning · {u.metInLearn} met in Learn
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-right md:table-cell">
                {percent(u.accuracy)}
                <div className="text-xs text-muted-foreground">{u.answers} {u.answers === 1 ? 'answer' : 'answers'}</div>
              </TableCell>
              <TableCell className="hidden text-right md:table-cell">
                {u.activeDays} <span className="text-muted-foreground">/ {data?.activeWindowDays}</span>
              </TableCell>
            </TableRow>
          ))}
          {data && items.length === 0 && (
            <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users match.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} {data?.total === 1 ? 'user' : 'users'} · bar = share of {totalWords} words</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
