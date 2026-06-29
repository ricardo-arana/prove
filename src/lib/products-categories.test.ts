import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

process.env.SQLITE_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'prove-cats-')),
  'test.sqlite',
)

const {
  insertCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  insertProduct,
  findProduct,
} = await import('#/lib/products-db.ts')

test('CRUD de categorías', () => {
  insertCategory({ id: 'c1', name: 'Lácteos', icon: '🥛', color: '#3366cc' })
  expect(listCategories().map((c) => c.name)).toEqual(['Lácteos'])

  updateCategory({ id: 'c1', name: 'Lácteos y huevos', icon: '🥚', color: '#3366cc' })
  expect(listCategories()[0].name).toBe('Lácteos y huevos')

  deleteCategory('c1')
  expect(listCategories()).toEqual([])
})

test('producto persiste categoryId', () => {
  insertCategory({ id: 'c2', name: 'Limpieza', icon: '🧽', color: '#22aa55' })
  insertProduct({
    id: 'p1',
    name: 'Jabón',
    area: 'pantry',
    expiresAt: '2026-09-01',
    quantity: '1',
    notes: '',
    source: 'manual',
    categoryId: 'c2',
  })
  expect(findProduct('p1')?.categoryId).toBe('c2')
})
