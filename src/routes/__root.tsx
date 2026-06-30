import {
  Boxes,
  Home as HomeIcon,
  Plus,
  Settings,
  ShoppingCart,
  Tag,
} from 'lucide-react'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Prove | Refrigeradora y despensa',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo-manzana-vencimiento.svg',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

const NAV = [
  { to: '/', label: 'Inventario', Icon: HomeIcon, exact: true },
  { to: '/lists', label: 'Listas', Icon: ShoppingCart, exact: false },
  { to: '/categories', label: 'Categorías', Icon: Tag, exact: false },
  { to: '/products', label: 'Todos', Icon: Boxes, exact: false },
] as const

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to)
}

function AppShell({ children }: { children: React.ReactNode }) {
  const isActive = useActive()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[262px] flex-none flex-col border-r border-border bg-card p-4 lg:flex">
        <div className="flex items-center gap-3 px-2 pb-5 pt-1">
          <div className="flex size-11 items-center justify-center rounded-[13px] bg-accent">
            <img
              src="/logo-manzana-vencimiento.svg"
              alt="Vencimiento"
              className="size-7"
            />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight">
              Vencimiento
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Tu despensa al día
            </div>
          </div>
        </div>

        <div className="px-2 pb-1.5 pt-2 text-[11px] font-bold tracking-widest text-muted-foreground">
          MENÚ
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, Icon, exact }) => {
            const active = isActive(to, exact)
            return (
              <Link
                key={to}
                to={to}
                className={
                  active
                    ? 'flex items-center gap-3 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground'
                    : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted'
                }
              >
                <Icon className="size-5" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        <Link
          to="/add"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_6px_16px_-8px_rgba(31,208,187,0.8)] transition active:scale-[0.98]"
        >
          <Plus className="size-4" />
          Agregar producto
        </Link>

        <Link
          to="/settings"
          className={
            isActive('/settings', false)
              ? 'mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-foreground'
              : 'mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted'
          }
        >
          <Settings className="size-5" />
          Ajustes
        </Link>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent">
            <img
              src="/logo-manzana-vencimiento.svg"
              alt="Vencimiento"
              className="size-6"
            />
          </div>
          <div className="text-base font-extrabold tracking-tight">
            Vencimiento
          </div>
        </header>

        <div className="flex-1 pb-20 lg:pb-0">{children}</div>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
          {NAV.map(({ to, label, Icon, exact }) => {
            const active = isActive(to, exact)
            return (
              <Link
                key={to}
                to={to}
                className={
                  active
                    ? 'flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-bold text-accent-foreground'
                    : 'flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium text-muted-foreground'
                }
              >
                <Icon className="size-[22px]" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
