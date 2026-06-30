import * as React from 'react'
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  addShoppingListItem,
  getAllProducts,
  getShoppingListDetail,
  removeShoppingListItem,
  toggleShoppingListItem,
} from '#/lib/products-server.ts'
import { cn } from '#/lib/utils.ts'
import { formatPrice } from '#/lib/format-price.ts'

import type {
  ShoppingListDetail,
  ShoppingListItemDetail,
} from '#/lib/products-server.ts'

export const Route = createFileRoute('/lists/$listId')({
  loader: ({ params }) =>
    getShoppingListDetail({ data: { id: params.listId } }),
  component: ShoppingListDetailPage,
})

const NO_CATEGORY = '__none__'

function ShoppingListDetailPage() {
  const initial = Route.useLoaderData()
  const { listId } = Route.useParams()
  const getDetailFn = useServerFn(getShoppingListDetail)
  const getAllProductsFn = useServerFn(getAllProducts)
  const addItemFn = useServerFn(addShoppingListItem)
  const removeItemFn = useServerFn(removeShoppingListItem)
  const toggleItemFn = useServerFn(toggleShoppingListItem)

  const [detail, setDetail] = React.useState<ShoppingListDetail | null>(initial)
  const [picklist, setPicklist] = React.useState<
    Array<{ name: string; categoryId: string | null }>
  >([])
  const [selected, setSelected] = React.useState('')
  const [qty, setQty] = React.useState('1')
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let active = true
    getAllProductsFn().then((products) => {
      if (!active) return
      const seen = new Map<string, string | null>()
      for (const p of products) {
        if (!seen.has(p.name)) seen.set(p.name, p.categoryId ?? null)
      }
      setPicklist(
        [...seen.entries()].map(([name, categoryId]) => ({ name, categoryId })),
      )
    })
    return () => {
      active = false
    }
  }, [getAllProductsFn])

  async function refresh() {
    const fresh = await getDetailFn({ data: { id: listId } })
    setDetail(fresh)
  }

  async function addItem() {
    if (!selected || busy) return
    setBusy(true)
    try {
      const product = picklist.find((p) => p.name === selected)
      await addItemFn({
        data: {
          listId,
          productName: selected,
          categoryId: product?.categoryId ?? null,
          quantity: qty.trim() || '1',
        },
      })
      setSelected('')
      setQty('1')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: string) {
    await removeItemFn({ data: { id } })
    await refresh()
  }

  async function toggleItem(id: string, checked: boolean) {
    // optimista
    setDetail((d) =>
      d
        ? {
            ...d,
            items: d.items.map((it) =>
              it.id === id ? { ...it, checked } : it,
            ),
          }
        : d,
    )
    await toggleItemFn({ data: { id, checked } })
    await refresh()
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackLink />
        <p className="mt-6 text-muted-foreground">Lista no encontrada.</p>
      </main>
    )
  }

  const groups = groupByCategory(detail)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <BackLink />
      <h1 className="mt-4 text-2xl font-semibold">{detail.list.name}</h1>

      <div className="mt-4 flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elige un producto..." />
          </SelectTrigger>
          <SelectContent>
            {picklist.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay productos creados.
              </div>
            ) : (
              picklist.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Cantidad"
          placeholder="1"
          className="w-16 text-center"
        />
        <Button onClick={addItem} disabled={!selected || busy}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      <div className="mt-6 grid gap-6">
        {groups.map(({ category, items }) => (
          <section key={category?.id ?? NO_CATEGORY}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="flex size-6 items-center justify-center rounded text-sm"
                style={{
                  backgroundColor: category ? `${category.color}22` : undefined,
                }}
              >
                {category?.icon || '🏷️'}
              </span>
              {category?.name ?? 'Sin categoría'}
            </h2>
            <ul className="mt-2 grid gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <button
                    type="button"
                    aria-label={
                      item.checked ? 'Marcar pendiente' : 'Marcar comprado'
                    }
                    aria-pressed={item.checked}
                    onClick={() => toggleItem(item.id, !item.checked)}
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border transition active:scale-95',
                      item.checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-transparent',
                    )}
                  >
                    <Check className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate font-medium',
                        item.checked && 'text-muted-foreground line-through',
                      )}
                    >
                      {item.productName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cantidad: {item.quantity}
                    </div>
                  </div>
                  <PriceInfo item={item} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${item.productName}`}
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {detail.items.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Lista vacía. Agrega productos arriba.
        </p>
      ) : null}
    </main>
  )
}

function PriceInfo({ item }: { item: ShoppingListItemDetail }) {
  if (item.count === 0) {
    return <span className="text-xs text-muted-foreground">Sin precios</span>
  }
  return (
    <div className="shrink-0 text-right text-xs">
      <div>
        <span className="text-muted-foreground">Más bajo: </span>
        <span className="font-medium text-foreground">
          {formatPrice(item.lowest ?? 0)}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Promedio: </span>
        <span className="font-medium text-foreground">
          {formatPrice(item.average ?? 0)}
        </span>
      </div>
    </div>
  )
}

function groupByCategory(detail: ShoppingListDetail) {
  const byId = new Map(detail.categories.map((c) => [c.id, c]))
  const groups = new Map<
    string,
    { category: (typeof detail.categories)[number] | null; items: ShoppingListItemDetail[] }
  >()

  for (const item of detail.items) {
    const key = item.categoryId && byId.has(item.categoryId) ? item.categoryId : NO_CATEGORY
    if (!groups.has(key)) {
      groups.set(key, {
        category: key === NO_CATEGORY ? null : (byId.get(key) ?? null),
        items: [],
      })
    }
    groups.get(key)!.items.push(item)
  }

  // categorías con items primero (orden de categories), "Sin categoría" al final
  return [...groups.values()].sort((a, b) => {
    if (!a.category) return 1
    if (!b.category) return -1
    return a.category.name.localeCompare(b.category.name)
  })
}

function BackLink() {
  return (
    <Link
      to="/lists"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Listas de compras
    </Link>
  )
}
