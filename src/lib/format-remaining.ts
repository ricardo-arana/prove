// Formatea días restantes: hasta 30 días en "d", luego redondeado a meses/años.
export function formatRemaining(days: number) {
  if (days <= 30) return `${days} d`

  if (days < 365) {
    const months = Math.round(days / 30)
    return `${months} ${months === 1 ? 'mes' : 'meses'}`
  }

  const years = Math.round(days / 365)
  return `${years} ${years === 1 ? 'año' : 'años'}`
}
