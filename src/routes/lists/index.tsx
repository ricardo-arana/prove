import * as React from 'react'
import { ArrowLeft, Check, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import {
  createShoppingList,
  getShoppingLists,
  removeShoppingList,
  updateShoppingList,
} from '#/lib/products-server.ts'

import type { ShoppingListRecord } from '#/lib/products-db.ts'

export const Route = createFileRoute('/lists/')({
  loader: () => getShoppingLists(),
  component: ShoppingListsPage,
})

function ShoppingListsPage() {
  const initial = Route.useLoaderData()
  const createFn = useServerFn(createShoppingList)
  const updateFn = useServerFn(updateShoppingList)
  const removeFn = useServerFn(removeShoppingList)

  const [lists, setLists] = React.useState<ShoppingListRecord[]>(initial)
  const [name, setName] = React.useState('')
  const [editingId, setEditingId] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (editingId) {
        const saved = await updateFn({ data: { id: editingId, name: name.trim() } })
        setLists((c) =>
          c.map((l) => (l.id === saved.id ? { ...l, name: saved.name } : l)),
        )
      } else {
        const saved = await createFn({
          data: { id: crypto.randomUUID(), name: name.trim() },
        })
        setLists((c) => [saved, ...c])
      }
      setName('')
      setEditingId('')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const previous = lists
    setLists((c) => c.filter((l) => l.id !== id))
    if (editingId === id) {
      setEditingId('')
      setName('')
    }
    try {
      await removeFn({ data: { id } })
    } catch {
      setLists(previous)
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

      <h1 className="mt-4 text-2xl font-semibold">Listas de compras</h1>

      <div className="mt-4 flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && save()}
          placeholder={editingId ? 'Nuevo nombre' : 'Nombre de la lista'}
        />
        <Button onClick={save} disabled={!name.trim() || saving}>
          <Check className="size-4" />
          {editingId ? 'Guardar' : 'Crear'}
        </Button>
        {editingId ? (
          <Button
            variant="outline"
            onClick={() => {
              setEditingId('')
              setName('')
            }}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <Link
              to="/lists/$listId"
              params={{ listId: list.id }}
              className="flex min-w-0 flex-1 items-center gap-2 hover:text-foreground"
            >
              <span className="truncate font-medium">{list.name}</span>
              <span className="text-xs text-muted-foreground">
                {list.itemCount} item{list.itemCount === 1 ? '' : 's'}
              </span>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Renombrar ${list.name}`}
              onClick={() => {
                setEditingId(list.id)
                setName(list.name)
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${list.name}`}
              onClick={() => remove(list.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {lists.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Aún no hay listas. Crea una arriba.
        </p>
      ) : null}
    </main>
  )
}
