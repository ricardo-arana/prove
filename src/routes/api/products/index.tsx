import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

const BodySchema = z.object({
  name: z.string().min(1),
  area: z.enum(['fridge', 'pantry']),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'usar formato YYYY-MM-DD'),
  quantity: z.string().min(1),
  notes: z.string().default(''),
  source: z.enum(['manual', 'ai']).default('manual'),
  imageUrl: z.string().optional(),
})

export const Route = createFileRoute('/api/products/')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: 'Body debe ser JSON válido.' }, { status: 400 })
        }

        const parsed = BodySchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { error: 'Datos inválidos.', issues: parsed.error.issues },
            { status: 400 },
          )
        }

        const { insertProduct } = await import('#/lib/products-db.ts')
        const created = insertProduct({ id: randomUUID(), ...parsed.data })
        if (!created) {
          return json({ error: 'No se pudo crear el producto.' }, { status: 500 })
        }

        const { imageUrl: _imageUrl, ...product } = created
        return json({ product }, { status: 201 })
      },
    },
  },
})
