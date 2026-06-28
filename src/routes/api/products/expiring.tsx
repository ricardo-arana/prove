import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'usar formato YYYY-MM-DD')
const QuerySchema = z.object({ start: date, end: date })

export const Route = createFileRoute('/api/products/expiring')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const parsed = QuerySchema.safeParse({
          start: url.searchParams.get('start'),
          end: url.searchParams.get('end'),
        })
        if (!parsed.success) {
          return json(
            {
              error:
                'Parámetros inválidos. Requiere start y end (YYYY-MM-DD).',
            },
            { status: 400 },
          )
        }

        const { start, end } = parsed.data
        if (start > end) {
          return json({ error: 'start debe ser <= end' }, { status: 400 })
        }

        const today = new Date().toISOString().slice(0, 10)
        const { listProductsExpiringInRange } = await import(
          '#/lib/products-db.ts'
        )
        const rows = listProductsExpiringInRange(start, end, today)

        const products = rows.map(({ imageUrl: _imageUrl, ...p }) => ({
          ...p,
          status:
            p.expiresAt < today ? ('expired' as const) : ('expiring' as const),
        }))

        return json({ today, count: products.length, products })
      },
    },
  },
})
