import { useQuery } from '@tanstack/react-query'
import { Flame, Target } from 'lucide-react'
import { Link } from 'react-router'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ARTICLES } from '@shared/types'
import { ArticleBadge } from '@/components/article-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'
import { percent } from '@/lib/article'
import type { ConfusionCell, HardWord, Overview, TrendPoint } from '@/lib/types'
import { cn } from '@/lib/utils'

const chartConfig = { accuracy: { label: 'Accuracy %', color: 'var(--chart-1)' } } satisfies ChartConfig

export default function Dashboard() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api.get<Overview>('/stats/overview') })
  const trend = useQuery({ queryKey: ['trend'], queryFn: () => api.get<{ series: TrendPoint[] }>('/stats/trend?days=30') })
  const confusion = useQuery({ queryKey: ['confusion'], queryFn: () => api.get<{ cells: ConfusionCell[] }>('/stats/confusion') })
  const hardest = useQuery({ queryKey: ['hardest'], queryFn: () => api.get<{ words: HardWord[] }>('/stats/hardest?limit=15') })
  const { data: me } = useMe()

  const o = overview.data
  if (overview.isLoading || !o) return <DashboardSkeleton />

  if (o.totals.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No words yet</CardTitle>
          <CardDescription>
            {me?.isAdmin ? 'Import your A1, A2 and B1 word lists to get started.' : 'Ask the admin to import the word lists.'}
          </CardDescription>
        </CardHeader>
        {me?.isAdmin && (
          <CardContent>
            <Button asChild><Link to="/import">Import words</Link></Button>
          </CardContent>
        )}
      </Card>
    )
  }

  const learned = o.totals.mastered
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Due for review</CardDescription>
            <CardTitle className="text-3xl">{o.dueNow}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            +{o.newLeftToday} new words allowed today
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1"><Flame className="size-4" /> Streak</CardDescription>
            <CardTitle className="text-3xl">{o.streak} {o.streak === 1 ? 'day' : 'days'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Today: {o.today.correct}/{o.today.attempts} correct
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1"><Target className="size-4" /> Article accuracy</CardDescription>
            <CardTitle className="text-3xl">{percent(o.accuracy.article)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Error rate: {o.accuracy.article === null ? '–' : `${Math.round((1 - o.accuracy.article) * 100)}%`} · spelling {percent(o.accuracy.lemma)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Mastered</CardDescription>
            <CardTitle className="text-3xl">{learned} <span className="text-lg font-normal text-muted-foreground">/ {o.totals.total}</span></CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {o.totals.learning} learning · {o.totals.fresh} not started
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button asChild size="lg"><Link to="/study">Start review</Link></Button>
        <Button asChild size="lg" variant="outline"><Link to="/study?mode=pick">Practice articles</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress by level</CardTitle>
          <CardDescription>Mastered = reached Leitner box 5.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {o.levels.map((l) => (
            <div key={l.level} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{l.level}</span>
                <span className="text-muted-foreground">{l.mastered} mastered · {l.learning} learning · {l.fresh} to learn ({l.total} total)</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                <div className="bg-green-500" style={{ width: `${(l.mastered / l.total) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(l.learning / l.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accuracy, last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.data && (
              <ChartContainer config={chartConfig} className="h-52 w-full">
                <LineChart data={trend.data.series} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={[0, 100]} width={32} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="accuracy" type="monotone" stroke="var(--color-accuracy)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Which articles do you mix up?</CardTitle>
            <CardDescription>Rows: the correct article. Columns: what you answered.</CardDescription>
          </CardHeader>
          <CardContent>{confusion.data && <ConfusionGrid cells={confusion.data.cells} />}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hardest words</CardTitle>
          <CardDescription>Highest error rate so far.</CardDescription>
        </CardHeader>
        <CardContent>
          {hardest.data?.words.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Word</TableHead>
                  <TableHead className="hidden sm:table-cell">Meaning</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hardest.data.words.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell><ArticleBadge article={w.article} /> {w.lemma}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{w.translation}</TableCell>
                    <TableCell>{w.level}</TableCell>
                    <TableCell className="text-right">{w.wrong}/{w.seen}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No mistakes recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ConfusionGrid({ cells }: { cells: ConfusionCell[] }) {
  const columns = [...ARTICLES, 'none'] as const
  const get = (correct: string, chosen: string) => cells.find((c) => c.correct === correct && c.chosen === chosen)?.n ?? 0
  if (!cells.length) return <p className="text-sm text-muted-foreground">Answer a few words to see this.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          {columns.map((c) => <TableHead key={c} className="text-center">{c === 'none' ? 'no answer' : c}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ARTICLES.map((row) => {
          const total = columns.reduce((s, c) => s + get(row, c), 0)
          return (
            <TableRow key={row}>
              <TableCell><ArticleBadge article={row} /></TableCell>
              {columns.map((col) => {
                const n = get(row, col)
                const share = total ? n / total : 0
                return (
                  <TableCell
                    key={col}
                    className={cn('text-center', col === row ? 'font-semibold text-green-700 dark:text-green-400' : n > 0 && 'text-red-700 dark:text-red-400')}
                    style={col === row || n === 0 ? undefined : { backgroundColor: `color-mix(in oklab, var(--destructive) ${Math.round(share * 60)}%, transparent)` }}
                  >
                    {n || ''}
                  </TableCell>
                )
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-60" />
    </div>
  )
}
