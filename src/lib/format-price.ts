// Formatea un monto en soles peruanos (PEN), ej: 12.5 -> "S/ 12.50".
export function formatPrice(value: number) {
  return value.toLocaleString('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
