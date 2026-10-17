import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ dailyNewLimit: number }>('/settings') })
  const [draft, setDraft] = useState<string | null>(null)
  const limit = draft ?? String(settings.data?.dailyNewLimit ?? 10)

  const save = useMutation({
    mutationFn: (dailyNewLimit: number) => api.put('/settings', { dailyNewLimit }),
    onSuccess: () => {
      toast.success('Saved')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const [resetOpen, setResetOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const resetAll = useMutation({
    mutationFn: () => api.post<{ wordsReset: number }>('/progress/reset', { scope: 'all' }),
    onSuccess: ({ wordsReset }) => {
      toast.success(`Progress reset (${wordsReset} ${wordsReset === 1 ? 'word' : 'words'})`)
      setResetOpen(false)
      void queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })

  const parsed = Number(limit)
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 100

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily new words</CardTitle>
          <CardDescription>How many never-seen words a review session may introduce per day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="limit">New words per day (0–100)</Label>
          <Input id="limit" type="number" min={0} max={100} value={limit} onChange={(e) => setDraft(e.target.value)} />
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(parsed)}>Save</Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Reset progress</CardTitle>
          <CardDescription>
            Erase everything you have learned: every word goes back to “not started”, and your answer history, accuracy
            charts and streak are cleared. The word list and your settings are kept. To reset a single word, use the
            menu on the Words page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => { setConfirmText(''); setResetOpen(true) }}>Reset all progress</Button>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">Signed in as {me?.email}</p>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        pending={resetAll.isPending}
        title="Reset all progress?"
        confirmLabel="Reset everything"
        canConfirm={confirmText === 'RESET'}
        onConfirm={() => resetAll.mutate()}
        description="This cannot be undone. Type RESET to confirm."
      >
        <Input aria-label="Type RESET to confirm" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </ConfirmDialog>
    </div>
  )
}
