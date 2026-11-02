/**
 * The separate meanings in a translation, normalised for comparison:
 * "woman; wife; Mrs." → ["woman", "wife", "mrs."], "(the) work" → ["work"].
 */
export function meanings(translation: string): string[] {
  return translation
    .toLowerCase()
    .split(/[;,/]/)
    .map((m) => m.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().replace(/^(the|a|an|to) /, ''))
    .filter(Boolean)
}

/** Whether two translations have a meaning in common, e.g. "wife" and "woman; wife; Mrs.". */
export function sharesMeaning(a: string, b: string): boolean {
  const ours = new Set(meanings(a))
  return meanings(b).some((m) => ours.has(m))
}

/** For each word, how many other words share one of its meanings. */
export function countSameMeaning(targets: { id: number; translation: string }[], all: { id: number; translation: string }[]): Map<number, number> {
  const byMeaning = new Map<string, number[]>()
  for (const w of all) {
    for (const m of meanings(w.translation)) {
      const ids = byMeaning.get(m)
      if (ids) ids.push(w.id)
      else byMeaning.set(m, [w.id])
    }
  }
  return new Map(targets.map((t) => {
    const others = new Set(meanings(t.translation).flatMap((m) => byMeaning.get(m) ?? []))
    others.delete(t.id)
    return [t.id, others.size]
  }))
}
