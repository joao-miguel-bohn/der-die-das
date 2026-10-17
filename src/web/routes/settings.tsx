import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
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
      <p className="text-center text-sm text-muted-foreground">Signed in as {me?.email}</p>
    </div>
  )
}
