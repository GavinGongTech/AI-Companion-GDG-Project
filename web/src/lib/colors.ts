/**
 * Maps an accuracy rate [0–1] to the corresponding CSS design-token color.
 * Thresholds: <0.4 = struggling (red), <0.7 = developing (yellow), ≥0.7 = mastered (green).
 */
export function accuracyColor(rate: number): string {
  if (rate < 0.4) return 'var(--red)'
  if (rate < 0.7) return 'var(--yellow)'
  return 'var(--green)'
}
