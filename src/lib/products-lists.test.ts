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
  setShoppingListItemChecked,
  removeShoppingListItem,
  deleteShoppingList,
} = await import('#/lib/products-db.ts')

test('CRUD de lista + items con cascada', () => {
  insertShoppingList('l1', 'Semana')
  addShoppingListItem('i1', 'l1', 'Leche', 'cat-lacteos', '2')
  addShoppingListItem('i2', 'l1', 'Pan', null, '1')

  expect(listShoppingLists()[0].itemCount).toBe(2)
  const items = listShoppingListItems('l1')
  expect(items.map((i) => i.productName)).toEqual(['Leche', 'Pan'])
  expect(items[0].quantity).toBe('2')
  expect(items[0].checked).toBe(false)

  removeShoppingListItem('i1')
  expect(listShoppingListItems('l1').map((i) => i.productName)).toEqual(['Pan'])

  deleteShoppingList('l1')
  expect(listShoppingLists()).toEqual([])
  expect(listShoppingListItems('l1')).toEqual([]) // items borrados en cascada
})

test('checked / checkedCount / orden (pendientes primero)', () => {
  insertShoppingList('l2', 'Mercado')
  addShoppingListItem('a', 'l2', 'Arroz', null, '1')
  addShoppingListItem('b', 'l2', 'Aceite', null, '1')

  setShoppingListItemChecked('a', true)

  const list = listShoppingLists().find((l) => l.id === 'l2')!
  expect(list.itemCount).toBe(2)
  expect(list.checkedCount).toBe(1)

  // checked al final (ORDER BY checked ASC)
  const items = listShoppingListItems('l2')
  expect(items.map((i) => i.checked)).toEqual([false, true])

  setShoppingListItemChecked('a', false)
  expect(
    listShoppingLists().find((l) => l.id === 'l2')!.checkedCount,
  ).toBe(0)
})
