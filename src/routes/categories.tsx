import * as React from 'react'
import { ArrowLeft, Check, Pencil, Trash2, X } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  createCategory,
  getCategories,
  removeCategory,
  updateCategory,
} from '#/lib/products-server.ts'
import { cn } from '#/lib/utils.ts'

import type { CategoryRecord } from '#/lib/products-server.ts'

export const Route = createFileRoute('/categories')({
  loader: () => getCategories(),
  component: CategoriesPage,
})

const SWATCHES = [
  '#1fd0bb',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
]

const emptyForm = { id: '', name: '', icon: '', color: '#1fd0bb' }

function CategoriesPage() {
  const initial = Route.useLoaderData()
  const createCategoryFn = useServerFn(createCategory)
  const updateCategoryFn = useServerFn(updateCategory)
  const removeCategoryFn = useServerFn(removeCategory)

  const [categories, setCategories] = React.useState<CategoryRecord[]>(initial)
  const [form, setForm] = React.useState(emptyForm)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const editing = Boolean(form.id)

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (!form.name.trim() || saving) return
    setError('')
    setSaving(true)
    const data = { ...form, id: form.id || crypto.randomUUID() }
    try {
      const saved = editing
        ? await updateCategoryFn({ data })
        : await createCategoryFn({ data })
      setCategories((current) =>
        editing
          ? current.map((c) => (c.id === saved.id ? saved : c))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setForm(emptyForm)
    } catch {
      setError('No se pudo guardar la categoría.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const previous = categories
    setCategories((current) => current.filter((c) => c.id !== id))
    if (form.id === id) setForm(emptyForm)
    try {
      await removeCategoryFn({ data: { id } })
    } catch {
      setCategories(previous)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al inventario
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Categorías</h1>

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">
          {editing ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Nombre</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Lácteos, Limpieza..."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-icon">Icono</Label>
            <Input
              id="cat-icon"
              value={form.icon}
              onChange={(event) => update('icon', event.target.value)}
              placeholder="🥛"
              className="w-16 text-center text-lg"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Color</Label>
            <div className="flex h-9 items-center gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color.toLowerCase() === c}
                  onClick={() => update('color', c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    'size-6 rounded-full transition active:scale-90',
                    form.color.toLowerCase() === c
                      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card'
                      : 'ring-1 ring-border',
                  )}
                />
              ))}
              <input
                type="color"
                aria-label="Color personalizado"
                value={form.color}
                onChange={(event) => update('color', event.target.value)}
                className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!form.name.trim() || saving}>
              <Check className="size-4" />
              {editing ? 'Guardar' : 'Agregar'}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={() => setForm(emptyForm)}>
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </section>

      <ul className="mt-4 grid gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-lg"
              style={{ backgroundColor: `${category.color}22` }}
            >
              {category.icon || '🏷️'}
            </span>
            <span className="flex-1 font-medium">{category.name}</span>
            <span
              className="size-4 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: category.color }}
              title={category.color}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${category.name}`}
              onClick={() => setForm(category)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${category.name}`}
              onClick={() => remove(category.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {categories.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Aún no hay categorías. Agrega una arriba.
        </p>
      ) : null}
    </main>
  )
}
