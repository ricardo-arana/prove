import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type {
  NewProductRecord,
  ProductRecord,
  StorageArea,
} from '#/lib/products-db.ts'

export interface ProductPhotoAnalysis {
  name: string
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
}) satisfies z.ZodType<NewProductRecord>

const DeleteProductSchema = z.object({
  id: z.string().min(1),
})

const AnalyzePhotoSchema = z.object({
  imageUrl: z.string().min(1),
  fileName: z.string().optional(),
})

const ProductPhotoAnalysisSchema = z.object({
  name: z.string(),
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
    const { insertProduct } = await import('#/lib/products-db.ts')
    return insertProduct(data)
  })

export const removeProduct = createServerFn({ method: 'POST' })
  .inputValidator(DeleteProductSchema)
  .handler(async ({ data }) => {
    const { deleteProduct } = await import('#/lib/products-db.ts')
    return deleteProduct(data.id)
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
