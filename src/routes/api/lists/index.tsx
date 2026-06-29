import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/lists/')({
  server: {
    handlers: {
      GET: async () => {
        const { listShoppingLists } = await import('#/lib/products-db.ts')
        return json({ lists: listShoppingLists() })
      },
    },
  },
})
