import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type StorageArea = 'fridge' | 'pantry'

export interface ProductRecord {
  id: string
  name: string
  area: StorageArea
  expiresAt: string
  quantity: string
  notes: string
  source: 'manual' | 'ai'
  imageUrl?: string
  createdAt: string
  discardedAt?: string | null
  categoryId?: string | null
}

export type NewProductRecord = Omit<ProductRecord, 'createdAt' | 'discardedAt'>

export interface PriceEntry {
  recordedAt: string // YYYY-MM-DD
  price: number
}

export interface CategoryRecord {
  id: string
  name: string
  icon: string // emoji
  color: string // hex
}

export interface ShoppingListRecord {
  id: string
  name: string
  itemCount: number
}

export interface ShoppingListItemRecord {
  id: string
  productName: string
  categoryId: string | null
}

const dbPath =
  process.env.SQLITE_DB_PATH ?? join(process.cwd(), 'data', 'prove.sqlite')

let db: DatabaseSync | undefined

function getDb() {
  if (db) return db

  mkdirSync(dirname(dbPath), { recursive: true })

  db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      area TEXT NOT NULL CHECK (area IN ('fridge', 'pantry')),
      expires_at TEXT NOT NULL,
      quantity TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL CHECK (source IN ('manual', 'ai')),
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS products_expires_at_idx
      ON products (expires_at);

    CREATE INDEX IF NOT EXISTS products_area_idx
      ON products (area);

    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      name_key TEXT NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS price_history_name_idx
      ON price_history (name_key, recorded_at);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#888888',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS sli_list_idx
      ON shopping_list_items (list_id);
  `)

  // Migraciones: columnas nuevas en bases existentes (ignora si ya existen).
  for (const sql of [
    'ALTER TABLE products ADD COLUMN discarded_at TEXT',
    'ALTER TABLE products ADD COLUMN category_id TEXT',
  ]) {
    try {
      db.exec(sql)
    } catch (error) {
      if (!/duplicate column/i.test((error as Error).message)) throw error
    }
  }

  return db
}

function nameKey(name: string) {
  return name.trim().toLowerCase()
}

export function listProducts() {
  return getDb()
    .prepare(
      `
        SELECT
          id,
          name,
          area,
          expires_at AS expiresAt,
          quantity,
          notes,
          source,
          image_url AS imageUrl,
          created_at AS createdAt,
          discarded_at AS discardedAt,
          category_id AS categoryId
        FROM products
        WHERE discarded_at IS NULL
        ORDER BY expires_at ASC, created_at DESC
      `,
    )
    .all() as unknown as ProductRecord[]
}

export function listAllProducts() {
  return getDb()
    .prepare(
      `
        SELECT
          id, name, area, expires_at AS expiresAt, quantity, notes,
          source, image_url AS imageUrl, created_at AS createdAt,
          discarded_at AS discardedAt, category_id AS categoryId
        FROM products
        ORDER BY discarded_at IS NOT NULL, expires_at ASC, created_at DESC
      `,
    )
    .all() as unknown as ProductRecord[]
}

export function discardProduct(id: string) {
  runWithWritableDb(() => {
    getDb()
      .prepare('UPDATE products SET discarded_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  })
  return findProduct(id)
}

export function addPriceEntry(name: string, price: number, recordedAt: string) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        `
          INSERT INTO price_history (id, name_key, product_name, price, recorded_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(randomUUID(), nameKey(name), name.trim(), price, recordedAt)
  })
}

export function listPriceHistory(name: string, sinceDate: string) {
  return getDb()
    .prepare(
      `
        SELECT recorded_at AS recordedAt, price
        FROM price_history
        WHERE name_key = ? AND recorded_at >= ?
        ORDER BY recorded_at ASC, created_at ASC
      `,
    )
    .all(nameKey(name), sinceDate) as unknown as PriceEntry[]
}

export function listProductNames() {
  const rows = getDb()
    .prepare(
      `
        SELECT name FROM products
        UNION
        SELECT product_name AS name FROM price_history
        ORDER BY name COLLATE NOCASE ASC
      `,
    )
    .all() as unknown as Array<{ name: string }>
  return rows.map((r) => r.name)
}

export function listProductsExpiringInRange(
  start: string, // YYYY-MM-DD
  end: string, // YYYY-MM-DD
  today: string, // YYYY-MM-DD
) {
  return getDb()
    .prepare(
      `
        SELECT
          id,
          name,
          area,
          expires_at AS expiresAt,
          quantity,
          notes,
          source,
          image_url AS imageUrl,
          created_at AS createdAt,
          (
            SELECT ph.price FROM price_history ph
            WHERE ph.name_key = lower(trim(products.name))
            ORDER BY ph.recorded_at DESC, ph.created_at DESC
            LIMIT 1
          ) AS lastPrice
        FROM products
        WHERE expires_at < ?              -- ya vencidos hasta hoy
           OR expires_at BETWEEN ? AND ?  -- por vencer dentro del rango
        ORDER BY expires_at ASC, created_at DESC
      `,
    )
    .all(today, start, end) as unknown as Array<
    ProductRecord & { lastPrice: number | null }
  >
}

export function insertProduct(product: NewProductRecord) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        `
          INSERT INTO products (
            id,
            name,
            area,
            expires_at,
            quantity,
            notes,
            source,
            image_url,
            category_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        product.id,
        product.name,
        product.area,
        product.expiresAt,
        product.quantity,
        product.notes,
        product.source,
        product.imageUrl ?? null,
        product.categoryId ?? null,
      )
  })

  return findProduct(product.id)
}

export function updateProduct(product: NewProductRecord) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        `
          UPDATE products
          SET
            name = ?,
            area = ?,
            expires_at = ?,
            quantity = ?,
            notes = ?,
            source = ?,
            image_url = ?,
            category_id = ?
          WHERE id = ?
        `,
      )
      .run(
        product.name,
        product.area,
        product.expiresAt,
        product.quantity,
        product.notes,
        product.source,
        product.imageUrl ?? null,
        product.categoryId ?? null,
        product.id,
      )
  })

  return findProduct(product.id)
}

export function deleteProduct(id: string) {
  runWithWritableDb(() => {
    getDb().prepare('DELETE FROM products WHERE id = ?').run(id)
  })
  return { success: true }
}

export function listCategories() {
  return getDb()
    .prepare(
      'SELECT id, name, icon, color FROM categories ORDER BY name COLLATE NOCASE ASC',
    )
    .all() as unknown as CategoryRecord[]
}

export function insertCategory(category: CategoryRecord) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        'INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)',
      )
      .run(category.id, category.name, category.icon, category.color)
  })
  return category
}

export function updateCategory(category: CategoryRecord) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
      )
      .run(category.name, category.icon, category.color, category.id)
  })
  return category
}

export function deleteCategory(id: string) {
  runWithWritableDb(() => {
    // ponytail: deja category_id colgando en productos; el form trata id inexistente como "sin categoría"
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
  })
  return { success: true }
}

export function listShoppingLists() {
  return getDb()
    .prepare(
      `
        SELECT
          l.id, l.name,
          (SELECT COUNT(*) FROM shopping_list_items i WHERE i.list_id = l.id)
            AS itemCount
        FROM shopping_lists l
        ORDER BY l.created_at DESC
      `,
    )
    .all() as unknown as ShoppingListRecord[]
}

export function findShoppingList(id: string) {
  return getDb()
    .prepare('SELECT id, name FROM shopping_lists WHERE id = ?')
    .get(id) as unknown as { id: string; name: string } | undefined
}

export function insertShoppingList(id: string, name: string) {
  runWithWritableDb(() => {
    getDb()
      .prepare('INSERT INTO shopping_lists (id, name) VALUES (?, ?)')
      .run(id, name)
  })
  return { id, name, itemCount: 0 }
}

export function updateShoppingList(id: string, name: string) {
  runWithWritableDb(() => {
    getDb()
      .prepare('UPDATE shopping_lists SET name = ? WHERE id = ?')
      .run(name, id)
  })
}

export function deleteShoppingList(id: string) {
  runWithWritableDb(() => {
    getDb().prepare('DELETE FROM shopping_list_items WHERE list_id = ?').run(id)
    getDb().prepare('DELETE FROM shopping_lists WHERE id = ?').run(id)
  })
  return { success: true }
}

export function listShoppingListItems(listId: string) {
  return getDb()
    .prepare(
      `
        SELECT id, product_name AS productName, category_id AS categoryId
        FROM shopping_list_items
        WHERE list_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(listId) as unknown as ShoppingListItemRecord[]
}

export function addShoppingListItem(
  id: string,
  listId: string,
  productName: string,
  categoryId: string | null,
) {
  runWithWritableDb(() => {
    getDb()
      .prepare(
        `
          INSERT INTO shopping_list_items (id, list_id, product_name, category_id)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(id, listId, productName, categoryId)
  })
}

export function findProductCategoryId(name: string): string | null {
  const row = getDb()
    .prepare(
      `SELECT category_id AS categoryId FROM products
       WHERE name = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(name) as { categoryId: string | null } | undefined
  return row?.categoryId ?? null
}

export function removeShoppingListItem(id: string) {
  runWithWritableDb(() => {
    getDb().prepare('DELETE FROM shopping_list_items WHERE id = ?').run(id)
  })
  return { success: true }
}

function runWithWritableDb(action: () => void) {
  try {
    action()
  } catch (error) {
    if (!isReadonlyDatabaseError(error)) throw error

    resetDbConnection()
    action()
  }
}

function resetDbConnection() {
  db?.close()
  db = undefined
}

function isReadonlyDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false

  return /readonly database/i.test(error.message)
}

export function findProduct(id: string) {
  return getDb()
    .prepare(
      `
        SELECT
          id,
          name,
          area,
          expires_at AS expiresAt,
          quantity,
          notes,
          source,
          image_url AS imageUrl,
          created_at AS createdAt,
          discarded_at AS discardedAt,
          category_id AS categoryId
        FROM products
        WHERE id = ?
      `,
    )
    .get(id) as unknown as ProductRecord | undefined
}
