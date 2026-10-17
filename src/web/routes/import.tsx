import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { parseImportFile } from '@shared/import'
import { ArticleBadge } from '@/components/article-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/hooks/use-me'
import { api } from '@/lib/api'

const CHUNK = 100

const EXAMPLE = `article,word,translation,level,plural,example
das,Haus,house,A1,Häuser,Das Haus ist groß.
der,Apfel,apple,A1,Äpfel,
die,Entscheidung,decision,B1,Entscheidungen,`

export default function ImportPage() {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('words.csv')
  const [progress, setProgress] = useState(0)

  const parsed = useMemo(
    () => (text.trim() ? parseImportFile(text.trimStart().startsWith('[') ? 'words.json' : filename, text) : null),
    [text, filename],
  )

  const upload = useMutation({
    mutationFn: async (rows: unknown[]) => {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await api.post('/import', { rows: rows.slice(i, i + CHUNK) })
        setProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)))
      }
    },
    onSuccess: () => {
      toast.success('Words imported')
      setText('')
      void queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setProgress(0),
  })

  if (me && !me.isAdmin) return <p className="text-muted-foreground">Only the admin can import words.</p>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import words</CardTitle>
          <CardDescription>
            CSV (comma, semicolon or tab) or JSON. Required: word, translation, level (A1/A2/B1). The article can be its own
            column or the start of the word ("das Haus"). Optional: plural, example. Re-importing updates existing words.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".csv,.tsv,.txt,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setFilename(file.name)
              setText(await file.text())
            }}
          />
          <textarea
            className="min-h-40 w-full rounded-md border bg-transparent p-3 font-mono text-sm"
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>
              {parsed.rows.length} valid · {parsed.errors.length} with problems
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.errors.length > 0 && (
              <ul className="max-h-40 overflow-auto rounded-md border p-3 text-sm text-destructive">
                {parsed.errors.slice(0, 50).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                {parsed.errors.length > 50 && <li>…and {parsed.errors.length - 50} more</li>}
              </ul>
            )}
            {parsed.rows.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Word</TableHead><TableHead>Meaning</TableHead><TableHead>Level</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 8).map((r) => (
                      <TableRow key={`${r.article}${r.lemma}`}>
                        <TableCell><ArticleBadge article={r.article} /> {r.lemma}</TableCell>
                        <TableCell className="text-muted-foreground">{r.translation}</TableCell>
                        <TableCell>{r.level}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {upload.isPending && <Progress value={progress} />}
                <Button disabled={upload.isPending} onClick={() => upload.mutate(parsed.rows)}>
                  Import {parsed.rows.length} words
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
