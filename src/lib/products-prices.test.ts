import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

process.env.SQLITE_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'prove-prices-')),
  'test.sqlite',
)

const {
  insertProduct,
  discardProduct,
  listProducts,
  addPriceEntry,
  listPriceHistory,
  listProductNames,
} = await import('#/lib/products-db.ts')

function makeProduct(id: string, name: string) {
  return {
    id,
    name,
    area: 'pantry' as const,
    expiresAt: '2026-07-01',
    quantity: '1',
    notes: '',
    source: 'manual' as const,
  }
}

test('discardProduct lo saca de listProducts pero conserva el registro', () => {
  insertProduct(makeProduct('a', 'Leche'))
  insertProduct(makeProduct('b', 'Atún'))

  discardProduct('a')

  const visibles = listProducts().map((p) => p.id)
  expect(visibles).not.toContain('a')
  expect(visibles).toContain('b')
})

test('historial de precios por nombre, ventana de fechas y nombres distintos', () => {
  // mismo nombre, distinta capitalización -> misma clave
  addPriceEntry('Leche', 4.5, '2026-01-15')
  addPriceEntry('leche', 5.0, '2026-06-01')
  addPriceEntry('Leche', 3.9, '2025-06-01') // fuera de ventana

  const history = listPriceHistory('LECHE', '2026-01-01')
  expect(history.map((h) => h.price)).toEqual([4.5, 5.0]) // ordenado, sin el viejo

  // listProductNames incluye nombres de productos e historial, sin duplicar
  const names = listProductNames()
  expect(names).toContain('Leche')
  expect(names).toContain('Atún')
})
