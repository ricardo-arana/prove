import * as React from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { addProductPrice, getProductDetail } from '#/lib/products-server.ts'
import { formatPrice } from '#/lib/format-price.ts'

import type { PriceSummary } from '#/lib/products-server.ts'

export const Route = createFileRoute('/products/$productId')({
  loader: ({ params }) =>
    getProductDetail({ data: { id: params.productId } }),
  component: ProductDetailPage,
})

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
  })
}

function ProductDetailPage() {
  const detail = Route.useLoaderData()
  const addProductPriceFn = useServerFn(addProductPrice)

  const [prices, setPrices] = React.useState<PriceSummary>(
    detail?.prices ?? { history: [], lowest: null, average: null, count: 0 },
  )
  const [price, setPrice] = React.useState('')
  const [recordedAt, setRecordedAt] = React.useState(todayISO())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <BackLink />
        <p className="mt-6 text-muted-foreground">Producto no encontrado.</p>
      </main>
    )
  }

  const { product } = detail

  async function addPrice() {
    const value = Number(price)
    if (!Number.isFinite(value) || value <= 0 || saving) {
      setError('Ingresa un precio válido.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const summary = await addProductPriceFn({
        data: { name: product.name, price, recordedAt },
      })
      setPrices(summary)
      setPrice('')
    } catch {
      setError('No se pudo guardar el precio.')
    } finally {
      setSaving(false)
    }
  }

  const chartData = prices.history.map((entry) => ({
    date: formatShortDate(entry.recordedAt),
    price: entry.price,
  }))

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackLink />

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">
          {product.name}
        </h1>
        {product.discardedAt ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            <Trash2 className="size-3" />
            No disponible
          </span>
        ) : null}
      </header>

      <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <InfoCard
          label="Ubicación"
          value={product.area === 'fridge' ? 'Refrigeradora' : 'Despensa'}
        />
        <InfoCard label="Cantidad" value={product.quantity} />
        {product.discardedAt ? null : (
          <InfoCard
            label="Vencimiento"
            value={formatShortDate(product.expiresAt)}
            expired={product.expiresAt < todayISO()}
          />
        )}
      </section>

      {product.notes ? (
        <section className="mt-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <div className="mb-1 text-sm font-medium text-muted-foreground">
            Notas
          </div>
          <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
            {product.notes}
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Historial de precios</h2>
        <p className="text-sm text-muted-foreground">Últimos 6 meses</p>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <StatCard
            label="Precio más bajo"
            value={prices.lowest === null ? '—' : formatPrice(prices.lowest)}
          />
          <StatCard
            label="Precio promedio"
            value={prices.average === null ? '—' : formatPrice(prices.average)}
          />
        </div>

        <div className="mt-4 h-64 rounded-lg border border-border bg-card p-4">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Aún no hay precios registrados. Agrega uno abajo.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} width={48} />
                <Tooltip
                  formatter={(value: number) => formatPrice(value)}
                  labelClassName="text-foreground"
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">Agregar precio</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="add-price">Precio (S/)</Label>
            <Input
              id="add-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-date">Fecha</Label>
            <Input
              id="add-date"
              type="date"
              value={recordedAt}
              max={todayISO()}
              onChange={(event) => setRecordedAt(event.target.value)}
            />
          </div>
          <Button onClick={addPrice} disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </section>
    </main>
  )
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Volver al inventario
    </Link>
  )
}

function InfoCard({
  label,
  value,
  expired = false,
}: {
  label: string
  value: string
  expired?: boolean
}) {
  return (
    <div
      className={
        expired
          ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-card-foreground'
          : 'rounded-lg border border-border bg-card p-3 text-card-foreground'
      }
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={
          expired
            ? 'mt-1 text-sm font-medium text-destructive [overflow-wrap:anywhere]'
            : 'mt-1 text-sm [overflow-wrap:anywhere]'
        }
      >
        {value}
        {expired ? ' · vencido' : ''}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}
