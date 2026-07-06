import { ArrowLeft, Refrigerator, Trash2, Warehouse } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { getAllProducts } from '#/lib/products-server.ts'

export const Route = createFileRoute('/products/')({
  loader: () => getAllProducts(),
  component: AllProductsPage,
})

function formatShortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function AllProductsPage() {
  const products = Route.useLoaderData()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al inventario
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Todos los productos</h1>
      <p className="text-sm text-muted-foreground">
        Incluye los que tiraste al tacho. {products.length} en total.
      </p>

      <ul className="mt-4 grid gap-2">
        {products.map((product) => {
          const Icon = product.area === 'fridge' ? Refrigerator : Warehouse
          const discarded = Boolean(product.discardedAt)
          const expired =
            !discarded && Boolean(product.expiresAt) && product.expiresAt < today
          return (
            <li key={product.id} className="min-w-0">
              <Link
                to="/products/$productId"
                params={{ productId: product.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground hover:bg-accent"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{product.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {product.quantity} ·{' '}
                    {product.area === 'fridge' ? 'Refrigeradora' : 'Despensa'}
                  </div>
                </div>
                {discarded ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Trash2 className="size-3" />
                    No disponible
                  </span>
                ) : (
                  <span
                    className={
                      expired
                        ? 'shrink-0 text-right text-xs font-medium text-destructive'
                        : 'shrink-0 text-right text-xs text-muted-foreground'
                    }
                  >
                    {product.expiresAt
                      ? formatShortDate(product.expiresAt)
                      : 'Sin vencimiento'}
                    {expired ? ' · vencido' : ''}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {products.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Aún no hay productos.</p>
      ) : null}
    </main>
  )
}
