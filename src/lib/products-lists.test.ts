import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

process.env.SQLITE_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'prove-lists-')),
  'test.sqlite',
)

const {
  insertShoppingList,
  listShoppingLists,
  addShoppingListItem,
  listShoppingListItems,
  removeShoppingListItem,
  deleteShoppingList,
} = await import('#/lib/products-db.ts')

test('CRUD de lista + items con cascada', () => {
  insertShoppingList('l1', 'Semana')
  addShoppingListItem('i1', 'l1', 'Leche', 'cat-lacteos')
  addShoppingListItem('i2', 'l1', 'Pan', null)

  expect(listShoppingLists()[0].itemCount).toBe(2)
  expect(listShoppingListItems('l1').map((i) => i.productName)).toEqual([
    'Leche',
    'Pan',
  ])

  removeShoppingListItem('i1')
  expect(listShoppingListItems('l1').map((i) => i.productName)).toEqual(['Pan'])

  deleteShoppingList('l1')
  expect(listShoppingLists()).toEqual([])
  expect(listShoppingListItems('l1')).toEqual([]) // items borrados en cascada
})
