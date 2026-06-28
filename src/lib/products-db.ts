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
}

export type NewProductRecord = Omit<ProductRecord, 'createdAt' | 'discardedAt'>

export interface PriceEntry {
  recordedAt: string // YYYY-MM-DD
  price: number
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
  `)

  // Migración: columna discarded_at en bases existentes (ignora si ya existe).
  try {
    db.exec('ALTER TABLE products ADD COLUMN discarded_at TEXT')
  } catch (error) {
    if (!/duplicate column/i.test((error as Error).message)) throw error
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
          discarded_at AS discardedAt
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
          discarded_at AS discardedAt
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
            image_url
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            image_url = ?
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
          discarded_at AS discardedAt
        FROM products
        WHERE id = ?
      `,
    )
    .get(id) as unknown as ProductRecord | undefined
}
