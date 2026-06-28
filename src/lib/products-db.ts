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
}

export type NewProductRecord = Omit<ProductRecord, 'createdAt'>

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
  `)

  return db
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
          created_at AS createdAt
        FROM products
        ORDER BY expires_at ASC, created_at DESC
      `,
    )
    .all() as unknown as ProductRecord[]
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
          created_at AS createdAt
        FROM products
        WHERE expires_at < ?              -- ya vencidos hasta hoy
           OR expires_at BETWEEN ? AND ?  -- por vencer dentro del rango
        ORDER BY expires_at ASC, created_at DESC
      `,
    )
    .all(today, start, end) as unknown as ProductRecord[]
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

function findProduct(id: string) {
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
          created_at AS createdAt
        FROM products
        WHERE id = ?
      `,
    )
    .get(id) as unknown as ProductRecord | undefined
}
