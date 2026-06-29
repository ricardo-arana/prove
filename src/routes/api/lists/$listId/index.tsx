import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/lists/$listId/')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const {
          findShoppingList,
          listShoppingListItems,
          listPriceHistory,
          listCategories,
        } = await import('#/lib/products-db.ts')

        const list = findShoppingList(params.listId)
        if (!list) {
          return json({ error: 'Lista no encontrada.' }, { status: 404 })
        }

        const items = listShoppingListItems(params.listId).map((item) => {
          const prices = listPriceHistory(item.productName, '0000-01-01').map(
            (h) => h.price,
          )
          const lowest = prices.length ? Math.min(...prices) : null
          const average = prices.length
            ? prices.reduce((a, b) => a + b, 0) / prices.length
            : null
          return { ...item, lowest, average, count: prices.length }
        })

        return json({ list, items, categories: listCategories() })
      },
    },
  },
})
