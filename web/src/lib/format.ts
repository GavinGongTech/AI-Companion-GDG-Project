/** Converts a snake_case concept ID to Title Case display label. */
export function formatConceptLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
