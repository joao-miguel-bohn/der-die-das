/**
 * Masks a German word for a Type it hint, e.g. ("Schrank", 2) → "Sc_____".
 * Never reveals the whole word; spaces and hyphens stay visible.
 */
export function maskLemma(lemma: string, letters: number): { masked: string; shown: number } {
  const chars = Array.from(lemma)
  const shown = Math.max(0, Math.min(letters, chars.length - 1))
  const masked = chars.map((ch, i) => (i < shown || ch === ' ' || ch === '-' ? ch : '_')).join('')
  return { masked, shown }
}
