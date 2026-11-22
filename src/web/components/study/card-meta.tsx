import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

/** One line above the word: level, why it's here, and why now. Kept small so the word sits high on a phone. */
export function CardMeta({ level, kind, children }: { level: string; kind: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Badge variant="outline">{level}</Badge>
      {kind && <Badge variant="secondary">{kind}</Badge>}
      <span>{children}</span>
    </div>
  )
}
