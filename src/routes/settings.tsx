import { Boxes, ShoppingCart, Tag } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const LINKS = [
  { to: '/categories', label: 'Categorías', desc: 'Crea y edita categorías', Icon: Tag },
  { to: '/lists', label: 'Listas de compras', desc: 'Gestiona tus listas', Icon: ShoppingCart },
  { to: '/products', label: 'Todos los productos', desc: 'Incluye los no disponibles', Icon: Boxes },
] as const

function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Ajustes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vencimiento — tu despensa al día.
      </p>

      <div className="mt-5 grid gap-2">
        {LINKS.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-accent/40"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <div>
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
