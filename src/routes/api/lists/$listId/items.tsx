import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

const BodySchema = z.object({
  productName: z.string().min(1),
  categoryId: z.string().nullable().optional(), // si se omite, se resuelve por nombre
  quantity: z.string().optional(), // default "1"
})

export const Route = createFileRoute('/api/lists/$listId/items')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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

        const { findShoppingList, addShoppingListItem, findProductCategoryId } =
          await import('#/lib/products-db.ts')

        if (!findShoppingList(params.listId)) {
          return json({ error: 'Lista no encontrada.' }, { status: 404 })
        }

        const { productName } = parsed.data
        const categoryId =
          parsed.data.categoryId !== undefined
            ? parsed.data.categoryId
            : findProductCategoryId(productName)

        const quantity = parsed.data.quantity?.trim() || '1'
        const id = randomUUID()
        addShoppingListItem(id, params.listId, productName, categoryId, quantity)

        return json(
          { item: { id, productName, categoryId, quantity } },
          { status: 201 },
        )
      },
    },
  },
})
