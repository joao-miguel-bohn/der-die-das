import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { importRowSchema } from '@shared/schemas'
import { ARTICLES, LEVELS, type Article, type Level } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { WordRow } from '@/lib/types'

interface Props {
  /** The word being edited; the dialog is closed when null. */
  word: WordRow | null
  onClose: () => void
}

export function EditWordDialog({ word, onClose }: Props) {
  return (
    <Dialog open={word !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Keyed by id so each word starts from its own saved values. */}
        {word && <EditForm key={word.id} word={word} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ word, onClose }: { word: WordRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [article, setArticle] = useState<Article>(word.article)
  const [lemma, setLemma] = useState(word.lemma)
  const [translation, setTranslation] = useState(word.translation)
  const [level, setLevel] = useState<Level>(word.level)
  const [plural, setPlural] = useState(word.plural ?? '')
  const [example, setExample] = useState(word.example ?? '')

  const parsed = importRowSchema.safeParse({ article, lemma, translation, level, plural, example })
  const changed =
    article !== word.article ||
    lemma.trim() !== word.lemma ||
    translation.trim() !== word.translation ||
    level !== word.level ||
    plural.trim() !== (word.plural ?? '') ||
    example.trim() !== (word.example ?? '')

  const save = useMutation({
    mutationFn: (body: unknown) => api.put(`/words/${word.id}`, body),
    onSuccess: () => {
      toast.success('Word saved')
      void queryClient.invalidateQueries()
      onClose()
    },
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (parsed.success && changed) save.mutate(parsed.data)
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit word</DialogTitle>
        <DialogDescription>
          Changes apply to everyone. Everybody’s progress on this word is kept, so fixing a typo does not reset anything.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-article">Article</Label>
          <Select value={article} onValueChange={(v) => setArticle(v as Article)}>
            <SelectTrigger id="edit-article"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ARTICLES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-lemma">Word</Label>
          <Input id="edit-lemma" autoFocus autoComplete="off" spellCheck={false} maxLength={100} value={lemma} onChange={(e) => setLemma(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-translation">Meaning</Label>
        <Input id="edit-translation" autoComplete="off" maxLength={300} value={translation} onChange={(e) => setTranslation(e.target.value)} />
      </div>

      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-level">Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger id="edit-level"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-plural">Plural (optional)</Label>
          <Input id="edit-plural" autoComplete="off" spellCheck={false} maxLength={300} value={plural} onChange={(e) => setPlural(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-example">Example sentence (optional)</Label>
        <Input id="edit-example" autoComplete="off" maxLength={300} value={example} onChange={(e) => setExample(e.target.value)} />
      </div>

      {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!parsed.success || !changed || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}
