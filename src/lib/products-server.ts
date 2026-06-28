import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { ProductRecord, StorageArea } from '#/lib/products-db.ts'

export interface ProductPhotoAnalysis {
  name: string
  expiresAt: string
  notes: string
}

export interface ProductExpirationSuggestion {
  expiresAt: string
  notes: string
}

const ProductInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  area: z.enum(['fridge', 'pantry']),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.string().min(1),
  notes: z.string(),
  source: z.enum(['manual', 'ai']),
  imageUrl: z.string().optional(),
  price: z.string().optional(),
})

function parsePrice(value?: string): number | null {
  if (!value) return null
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function sixMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

export interface PriceSummary {
  history: Array<{ recordedAt: string; price: number }>
  lowest: number | null
  average: number | null
  count: number
}

export interface ProductDetail {
  product: ProductRecord
  prices: PriceSummary
}

const DeleteProductSchema = z.object({
  id: z.string().min(1),
})

const AnalyzePhotoSchema = z.object({
  imageUrl: z.string().min(1),
  fileName: z.string().optional(),
})

const SuggestExpirationSchema = z.object({
  name: z.string().min(1),
  notes: z.string(),
  quantity: z.string(),
  area: z.enum(['fridge', 'pantry']),
})

const ProductPhotoAnalysisSchema = z.object({
  name: z.string(),
  expiresAt: z.string(),
  notes: z.string(),
})

const ProductExpirationSuggestionSchema = z.object({
  expiresAt: z.string(),
  notes: z.string(),
})

const datePatterns = [
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,
]

export const getProducts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProductRecord[]> => {
    const { listProducts } = await import('#/lib/products-db.ts')
    return listProducts()
  },
)

export const createProduct = createServerFn({ method: 'POST' })
  .inputValidator(ProductInputSchema)
  .handler(async ({ data }): Promise<ProductRecord | undefined> => {
    const { insertProduct, addPriceEntry } = await import('#/lib/products-db.ts')
    const { price, ...record } = data
    const created = insertProduct(record)

    const value = parsePrice(price)
    if (value !== null) addPriceEntry(record.name, value, todayISO())

    return created
  })

export const updateProduct = createServerFn({ method: 'POST' })
  .inputValidator(ProductInputSchema)
  .handler(async ({ data }): Promise<ProductRecord | undefined> => {
    const { updateProduct: updateProductRecord, addPriceEntry } = await import(
      '#/lib/products-db.ts'
    )
    const { price, ...record } = data
    const updated = updateProductRecord(record)

    const value = parsePrice(price)
    if (value !== null) addPriceEntry(record.name, value, todayISO())

    return updated
  })

const DiscardProductSchema = z.object({ id: z.string().min(1) })

export const discardProduct = createServerFn({ method: 'POST' })
  .inputValidator(DiscardProductSchema)
  .handler(async ({ data }): Promise<ProductRecord | undefined> => {
    const { discardProduct: discard } = await import('#/lib/products-db.ts')
    return discard(data.id)
  })

const ProductIdSchema = z.object({ id: z.string().min(1) })

export const getProductDetail = createServerFn({ method: 'GET' })
  .inputValidator(ProductIdSchema)
  .handler(async ({ data }): Promise<ProductDetail | null> => {
    const { findProduct, listPriceHistory } = await import(
      '#/lib/products-db.ts'
    )
    const product = findProduct(data.id)
    if (!product) return null

    const history = listPriceHistory(product.name, sixMonthsAgo())
    return { product, prices: summarizePrices(history) }
  })

const AddPriceSchema = z.object({
  name: z.string().min(1),
  price: z.string().min(1),
  recordedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const addProductPrice = createServerFn({ method: 'POST' })
  .inputValidator(AddPriceSchema)
  .handler(async ({ data }): Promise<PriceSummary> => {
    const { addPriceEntry, listPriceHistory } = await import(
      '#/lib/products-db.ts'
    )
    const value = parsePrice(data.price)
    if (value === null) throw new Error('Precio inválido.')

    addPriceEntry(data.name, value, data.recordedAt ?? todayISO())
    return summarizePrices(listPriceHistory(data.name, sixMonthsAgo()))
  })

export const getAllProducts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProductRecord[]> => {
    const { listAllProducts } = await import('#/lib/products-db.ts')
    return listAllProducts()
  },
)

export const getProductNames = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => {
    const { listProductNames } = await import('#/lib/products-db.ts')
    return listProductNames()
  },
)

function summarizePrices(
  history: Array<{ recordedAt: string; price: number }>,
): PriceSummary {
  if (history.length === 0) {
    return { history, lowest: null, average: null, count: 0 }
  }
  const prices = history.map((h) => h.price)
  const lowest = Math.min(...prices)
  const average = prices.reduce((a, b) => a + b, 0) / prices.length
  return { history, lowest, average, count: history.length }
}

export const removeProduct = createServerFn({ method: 'POST' })
  .inputValidator(DeleteProductSchema)
  .handler(async ({ data }) => {
    const { deleteProduct } = await import('#/lib/products-db.ts')
    return deleteProduct(data.id)
  })

export const suggestProductExpiration = createServerFn({ method: 'POST' })
  .inputValidator(SuggestExpirationSchema)
  .handler(async ({ data }): Promise<ProductExpirationSuggestion> => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return {
        expiresAt: '',
        notes: 'Configura OPENAI_API_KEY para sugerir vencimientos con IA.',
      }
    }

    try {
      const today = new Date().toISOString().slice(0, 10)
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-5.2',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Estima una fecha de vencimiento razonable para un producto de cocina.',
                    `Fecha actual: ${today}.`,
                    'Usa el nombre del producto, notas, cantidad y ubicacion.',
                    'Asume que la fecha debe ser aproximada y futura, salvo que las notas indiquen una fecha concreta.',
                    'Devuelve una fecha ISO YYYY-MM-DD y una nota breve explicando la estimacion.',
                    'Si no hay suficiente informacion, devuelve expiresAt como cadena vacia.',
                    `Producto: ${data.name}`,
                    `Notas: ${data.notes || 'Sin notas'}`,
                    `Cantidad: ${data.quantity || 'No especificada'}`,
                    `Ubicacion: ${
                      data.area === 'fridge' ? 'Refrigeradora' : 'Despensa'
                    }`,
                  ].join('\n'),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'product_expiration_suggestion',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  expiresAt: {
                    type: 'string',
                    description: 'Fecha ISO YYYY-MM-DD o cadena vacia.',
                  },
                  notes: {
                    type: 'string',
                    description: 'Explicacion breve de la estimacion.',
                  },
                },
                required: ['expiresAt', 'notes'],
              },
            },
          },
        }),
      })

      if (!response.ok) {
        return {
          expiresAt: '',
          notes: `OpenAI respondio ${response.status}; completa la fecha manualmente.`,
        }
      }

      const payload = (await response.json()) as OpenAIResponsesPayload
      const outputText = extractResponseText(payload)
      const parsed = ProductExpirationSuggestionSchema.parse(
        JSON.parse(outputText || '{}'),
      )

      return {
        expiresAt: parsed.expiresAt,
        notes: parsed.notes || 'Fecha sugerida por IA.',
      }
    } catch {
      return {
        expiresAt: '',
        notes: 'No se pudo sugerir la fecha con IA. Completa la fecha manualmente.',
      }
    }
  })

export const analyzeProductPhoto = createServerFn({ method: 'POST' })
  .inputValidator(AnalyzePhotoSchema)
  .handler(async ({ data }): Promise<ProductPhotoAnalysis> => {
    const fallback = fallbackProductPhotoAnalysis(data.fileName ?? '')
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) return fallback

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_VISION_MODEL ?? 'gpt-5.2',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Analiza esta foto de un producto de refrigeradora o despensa.',
                    'Identifica el producto y lee la fecha de vencimiento solo si es visible.',
                    'Devuelve una fecha ISO YYYY-MM-DD cuando tengas suficiente confianza.',
                    'Si no puedes leer algo, devuelve cadena vacia para ese campo.',
                  ].join(' '),
                },
                {
                  type: 'input_image',
                  image_url: data.imageUrl,
                  detail: 'high',
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'product_expiration_scan',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  expiresAt: {
                    type: 'string',
                    description: 'Fecha ISO YYYY-MM-DD o cadena vacia.',
                  },
                  notes: { type: 'string' },
                },
                required: ['name', 'expiresAt', 'notes'],
              },
            },
          },
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null

        return {
          ...fallback,
          notes: `OpenAI respondio ${response.status}: ${
            errorPayload?.error?.message ??
            'revisa el formato de la imagen, el modelo o los permisos.'
          }`,
        }
      }

      const payload = (await response.json()) as OpenAIResponsesPayload
      const outputText = extractResponseText(payload)
      const parsed = ProductPhotoAnalysisSchema.parse(
        JSON.parse(outputText || '{}'),
      )

      return {
        name: parsed.name,
        expiresAt: parsed.expiresAt,
        notes:
          parsed.notes ||
          'Sugerido por IA desde la foto. Confirma los datos antes de guardar.',
      }
    } catch {
      return {
        ...fallback,
        notes:
          'No se pudo leer la respuesta de OpenAI. Revisa la consola del servidor y completa manualmente.',
      }
    }
  })

export type { ProductRecord, StorageArea }

interface OpenAIResponsesPayload {
  output_text?: string
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
  }>
}

function extractResponseText(payload: OpenAIResponsesPayload) {
  if (payload.output_text) return payload.output_text

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => typeof content.text === 'string')?.text ?? ''
  )
}

function fallbackProductPhotoAnalysis(fileName: string): ProductPhotoAnalysis {
  const guessedDate = extractDate(fileName)

  return {
    name: guessProductName(fileName),
    expiresAt: guessedDate,
    notes: process.env.OPENAI_API_KEY
      ? 'No se pudo completar el analisis de IA. Revisa la foto o completa manualmente.'
      : 'Configura OPENAI_API_KEY para activar reconocimiento real por IA.',
  }
}

function extractDate(text: string) {
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (!match) continue

    const [, first, second, third] = match
    const yearFirst = first.length === 4
    const year = yearFirst ? first : normalizeYear(third)
    const month = second
    const day = yearFirst ? third : first

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return ''
}

function normalizeYear(value: string) {
  if (value.length === 4) return value
  return `20${value}`
}

function guessProductName(fileName: string) {
  const cleanName = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(datePatterns[0], '')
    .replace(datePatterns[1], '')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (!cleanName) return ''

  return cleanName
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
