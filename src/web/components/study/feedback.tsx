import { Check, X } from 'lucide-react'
import { DAY_MS } from '@shared/dates'
import { ArticleBadge } from '@/components/article-badge'
import type { AnswerResult } from '@/lib/types'
import { cn } from '@/lib/utils'

function nextReview(result: AnswerResult): string {
  if (!result.correct) return 'This word comes back in your next review.'
  const days = Math.round((result.dueAt - Date.now()) / DAY_MS)
  if (days <= 0) return ''
  return `Next review in ${days} ${days === 1 ? 'day' : 'days'} (box ${result.box}).`
}

export function Feedback({ result, typed }: { result: AnswerResult; typed?: string }) {
  const { answer } = result
  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border p-4',
        result.correct
          ? 'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40'
          : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
      )}
    >
      <div className="flex items-center gap-2 text-lg font-semibold">
        {result.correct ? <Check className="size-5 text-green-600" /> : <X className="size-5 text-red-600" />}
        <ArticleBadge article={answer.article} className="text-base" />
        <span>{answer.lemma}</span>
      </div>

      {!result.correct && typed !== undefined && (
        <ul className="text-sm">
          <li>{result.articleOk ? '✓ Article correct' : '✗ Wrong article'}</li>
          <li>
            {result.lemmaOk
              ? '✓ Spelling correct'
              : result.capitalizationOnly
                ? '✗ Nouns are capitalised in German'
                : '✗ Check the spelling'}
            {typed && <span className="text-muted-foreground"> — you typed “{typed}”</span>}
          </li>
        </ul>
      )}

      {result.hint && (
        <p className="text-sm">
          <span className="font-medium">Tip:</span> {result.hint.text}
        </p>
      )}
      <div className="space-y-0.5 text-sm text-muted-foreground">
        <p>{answer.translation}</p>
        {answer.plural && <p>Plural: die {answer.plural}</p>}
        {answer.example && <p className="italic">{answer.example}</p>}
        <p>{nextReview(result)}</p>
      </div>
    </div>
  )
}
