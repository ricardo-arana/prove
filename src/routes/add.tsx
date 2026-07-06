import * as React from 'react'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import {
  createProduct,
  getCategories,
  getProductDetail,
  getProductNames,
  suggestProductExpiration,
  updateProduct,
} from '#/lib/products-server.ts'

import type { StorageArea } from '#/lib/products-server.ts'

export const Route = createFileRoute('/add')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : undefined,
  }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    const [categories, names] = await Promise.all([
      getCategories(),
      getProductNames(),
    ])
    const detail = deps.id
      ? await getProductDetail({ data: { id: deps.id } })
      : null
    return { categories, names, product: detail?.product ?? null }
  },
  component: AddProductPage,
})

function AddProductPage() {
  const { categories, names, product } = Route.useLoaderData()
  const navigate = useNavigate()
  const createFn = useServerFn(createProduct)
  const updateFn = useServerFn(updateProduct)
  const suggestFn = useServerFn(suggestProductExpiration)

  const editing = Boolean(product)
  const [name, setName] = React.useState(product?.name ?? '')
  const [area, setArea] = React.useState<StorageArea>(product?.area ?? 'fridge')
  const [quantity, setQuantity] = React.useState(product?.quantity ?? '1 unidad')
  const [categoryId, setCategoryId] = React.useState(product?.categoryId ?? '')
  const [price, setPrice] = React.useState('')
  const [expiresAt, setExpiresAt] = React.useState(product?.expiresAt ?? '')
  const [notes, setNotes] = React.useState(product?.notes ?? '')
  const [saving, setSaving] = React.useState(false)
  const [suggesting, setSuggesting] = React.useState(false)
  const [suggestion, setSuggestion] = React.useState('')
  const [error, setError] = React.useState('')

  async function suggestExpiration() {
    if (!name.trim() || suggesting) return
    setSuggesting(true)
    setSuggestion('Consultando IA...')
    try {
      const result = await suggestFn({
        data: { name: name.trim(), notes: notes.trim(), quantity, area },
      })
      if (result.expiresAt) setExpiresAt(result.expiresAt)
      setSuggestion(result.notes || 'Fecha sugerida por IA.')
    } catch {
      setSuggestion('No se pudo sugerir la fecha con IA.')
    } finally {
      setSuggesting(false)
    }
  }

  async function save() {
    if (!name.trim() || saving) return
    setError('')
    setSaving(true)
    const data = {
      id: product?.id ?? crypto.randomUUID(),
      name: name.trim(),
      area,
      expiresAt,
      quantity: quantity.trim() || '1 unidad',
      notes: notes.trim(),
      source: product?.source ?? ('manual' as const),
      imageUrl: product?.imageUrl ?? undefined,
      price: price.trim() || undefined,
      categoryId: categoryId || null,
    }
    try {
      if (editing) await updateFn({ data })
      else await createFn({ data })
      navigate({ to: '/products/$productId', params: { productId: data.id } })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el producto.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {editing ? 'Volver al inventario' : 'Cancelar'}
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        {editing ? 'Editar producto' : 'Agregar producto'}
      </h1>

      <div className="mt-5 grid gap-5 rounded-2xl border border-border bg-card p-6">
        <Field label="Producto" htmlFor="name">
          <Input
            id="name"
            list="product-names"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Leche, atún, verduras..."
          />
          <datalist id="product-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ubicación">
            <Select
              value={area}
              onValueChange={(v) => setArea(v as StorageArea)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fridge">Refrigeradora</SelectItem>
                <SelectItem value="pantry">Despensa</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cantidad" htmlFor="quantity">
            <Input
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1 unidad"
            />
          </Field>
        </div>

        <Field label="Categoría (opcional)">
          <Select
            value={categoryId || 'none'}
            onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Precio de compra (opcional)" htmlFor="price">
          <div className="flex items-center gap-2 rounded-md border border-input px-3">
            <span className="text-sm font-semibold text-muted-foreground">
              S/
            </span>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se guarda en el historial de precios del producto.
          </p>
        </Field>

        <Field label="Vencimiento" htmlFor="expiresAt">
          <div className="flex gap-2">
            <Input
              id="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Sugerir vencimiento con IA"
              title="Sugerir vencimiento con IA"
              disabled={!name.trim() || suggesting}
              onClick={suggestExpiration}
            >
              <Sparkles className={suggesting ? 'size-4 animate-pulse' : 'size-4'} />
            </Button>
          </div>
          {suggestion ? (
            <p className="text-xs text-muted-foreground">{suggestion}</p>
          ) : null}
        </Field>

        <Field label="Notas" htmlFor="notes">
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lugar, marca, estado o cualquier detalle útil."
          />
        </Field>

        <Button
          className="w-full"
          disabled={!name.trim() || saving}
          onClick={save}
        >
          <Check className="size-4" />
          {saving
            ? 'Guardando...'
            : editing
              ? 'Guardar cambios'
              : 'Guardar producto'}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
    </div>
  )
}
