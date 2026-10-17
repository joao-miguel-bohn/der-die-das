import type { Article } from '@shared/types'
import { ARTICLE_STYLES } from '@/lib/article'
import { cn } from '@/lib/utils'

export function ArticleBadge({ article, className }: { article: Article; className?: string }) {
  return (
    <span className={cn('inline-block rounded px-1.5 py-0.5 text-sm font-semibold', ARTICLE_STYLES[article], className)}>
      {article}
    </span>
  )
}
