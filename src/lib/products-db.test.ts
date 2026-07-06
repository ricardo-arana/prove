import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// DB temporal antes de importar el módulo (lee SQLITE_DB_PATH al cargar).
process.env.SQLITE_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'prove-test-')),
  'test.sqlite',
)

const { insertProduct, listProducts, listAllProducts, listProductsExpiringInRange } =
  await import('#/lib/products-db.ts')

function makeProduct(id: string, expiresAt: string) {
  return {
    id,
    name: id,
    area: 'pantry' as const,
    expiresAt,
    quantity: '1',
    notes: '',
    source: 'manual' as const,
  }
}

test('listProductsExpiringInRange separa vencidos, en rango y excluye futuros', () => {
  const today = '2026-06-27'
  insertProduct(makeProduct('expired', '2026-06-26')) // ayer
  insertProduct(makeProduct('inRange', '2026-07-01')) // dentro de [start,end]
  insertProduct(makeProduct('future', '2026-08-15')) // fuera de rango futuro

  const rows = listProductsExpiringInRange('2026-06-27', '2026-07-10', today)
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))

  expect(byId['expired'].expiresAt).toBe('2026-06-26')
  expect(byId['inRange'].expiresAt).toBe('2026-07-01')
  expect(byId['future']).toBeUndefined()

  // status derivado igual que en la ruta HTTP
  const status = (e: string) => (e < today ? 'expired' : 'expiring')
  expect(status(byId['expired'].expiresAt)).toBe('expired')
  expect(status(byId['inRange'].expiresAt)).toBe('expiring')
})

test('producto sin vencimiento: fuera del home y de vencimientos, presente en todos', () => {
  insertProduct(makeProduct('noExpiry', ''))

  expect(listProducts().some((p) => p.id === 'noExpiry')).toBe(false)
  expect(
    listProductsExpiringInRange('2026-06-27', '2026-07-10', '2026-06-27').some(
      (p) => p.id === 'noExpiry',
    ),
  ).toBe(false)

  const all = listAllProducts()
  expect(all.some((p) => p.id === 'noExpiry')).toBe(true)
  // sin vencimiento va al final entre los no descartados
  const active = all.filter((p) => !p.discardedAt)
  expect(active[active.length - 1].id).toBe('noExpiry')
})
