import * as React from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  ChefHat,
  Clock3,
  ImageUp,
  PackagePlus,
  Refrigerator,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Warehouse,
  X,
} from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
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
  analyzeProductPhoto,
  createProduct,
  getProducts,
  removeProduct,
} from '#/lib/products-server.ts'
import { cn } from '#/lib/utils.ts'

import type { ProductRecord, StorageArea } from '#/lib/products-server.ts'

export const Route = createFileRoute('/')({ component: Home })

type Product = ProductRecord

interface ProductFormState {
  name: string
  area: StorageArea
  expiresAt: string
  quantity: string
  notes: string
}

const emptyForm: ProductFormState = {
  name: '',
  area: 'fridge',
  expiresAt: '',
  quantity: '1 unidad',
  notes: '',
}

function Home() {
  const getProductsFn = useServerFn(getProducts)
  const createProductFn = useServerFn(createProduct)
  const removeProductFn = useServerFn(removeProduct)
  const analyzeProductPhotoFn = useServerFn(analyzeProductPhoto)
  const [products, setProducts] = React.useState<Product[]>([])
  const [form, setForm] = React.useState<ProductFormState>(emptyForm)
  const [query, setQuery] = React.useState('')
  const [activeArea, setActiveArea] = React.useState<'all' | StorageArea>('all')
  const [loadingProducts, setLoadingProducts] = React.useState(true)
  const [savingProduct, setSavingProduct] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const [productModalOpen, setProductModalOpen] = React.useState(false)
  const [cameraModalOpen, setCameraModalOpen] = React.useState(false)
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [cameraError, setCameraError] = React.useState('')
  const [scanPreview, setScanPreview] = React.useState('')
  const [aiStatus, setAiStatus] = React.useState<
    'idle' | 'analyzing' | 'ready' | 'needs-review'
  >('idle')
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  React.useEffect(() => {
    let active = true

    getProductsFn()
      .then((loadedProducts) => {
        if (active) setProducts(loadedProducts)
      })
      .finally(() => {
        if (active) setLoadingProducts(false)
      })

    return () => {
      active = false
    }
  }, [getProductsFn])

  React.useEffect(() => {
    return () => stopCamera()
  }, [])

  const stats = React.useMemo(() => {
    const today = startOfToday()
    const soonLimit = addDays(today, 7)

    return {
      total: products.length,
      fridge: products.filter((product) => product.area === 'fridge').length,
      pantry: products.filter((product) => product.area === 'pantry').length,
      urgent: products.filter((product) => {
        const date = parseLocalDate(product.expiresAt)
        return date <= soonLimit
      }).length,
    }
  }, [products])

  const filteredProducts = React.useMemo(() => {
    return [...products]
      .filter((product) => activeArea === 'all' || product.area === activeArea)
      .filter((product) => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return true

        return `${product.name} ${product.notes} ${product.quantity}`
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
  }, [activeArea, products, query])

  function updateForm<TKey extends keyof ProductFormState>(
    key: TKey,
    value: ProductFormState[TKey],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function addProduct(source: Product['source'] = 'manual') {
    if (!form.name.trim() || !form.expiresAt || savingProduct) return

    setSaveError('')
    setSavingProduct(true)

    const product = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      area: form.area,
      expiresAt: form.expiresAt,
      quantity: form.quantity.trim() || '1 unidad',
      notes: form.notes.trim(),
      source,
      imageUrl: scanPreview || undefined,
    }

    try {
      const savedProduct = await createProductFn({ data: product })
      if (savedProduct) {
        setProducts((current) => [savedProduct, ...current])
      }
      setForm(emptyForm)
      setScanPreview('')
      setAiStatus('idle')
      setProductModalOpen(false)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el producto.',
      )
    } finally {
      setSavingProduct(false)
    }
  }

  async function removeProductById(id: string) {
    const previousProducts = products
    setProducts((current) => current.filter((product) => product.id !== id))

    try {
      await removeProductFn({ data: { id } })
    } catch {
      setProducts(previousProducts)
    }
  }

  async function openCamera() {
    setCameraError('')

    if (
      !('mediaDevices' in navigator) ||
      !('getUserMedia' in navigator.mediaDevices)
    ) {
      setCameraError('Tu navegador no permite acceso directo a la camara.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })

      streamRef.current = stream
      setCameraOpen(true)

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
    } catch {
      setCameraError('No pude abrir la camara. Puedes subir una foto.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function closeCamera() {
    stopCamera()
    setCameraOpen(false)
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    context?.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
    await analyzePhoto(dataUrl)
    closeCamera()
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const dataUrl = await normalizeImageFile(file)
    await analyzePhoto(dataUrl, file.name)
    event.target.value = ''
  }

  async function analyzePhoto(imageUrl: string, fileName = '') {
    setScanPreview(imageUrl)
    setAiStatus('analyzing')

    const result = await analyzeProductPhotoFn({
      data: {
        imageUrl,
        fileName,
      },
    })

    setForm((current) => ({
      ...current,
      name: result.name || current.name || 'Producto detectado',
      expiresAt: result.expiresAt || current.expiresAt,
      notes: result.notes,
    }))
    setAiStatus(result.expiresAt ? 'ready' : 'needs-review')
    setCameraModalOpen(false)
    setProductModalOpen(true)
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                <img
                  alt="Logo de la aplicacion"
                  className="size-11 rounded-md"
                  src="/logo-manzana-vencimiento.svg"
                />
                Vencimiento
              </div>
              <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
                Productos al dia, sin sorpresas al vencer.
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
              <Metric label="Total" value={stats.total} />
              <Metric label="Refrigeradora" value={stats.fridge} />
              <Metric label="Despensa" value={stats.pantry} />
              <Metric label="Por vencer" value={stats.urgent} tone="urgent" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
          <ActionCard
            icon={<PackagePlus className="size-5" />}
            title="Agregar producto"
            onClick={() => setProductModalOpen(true)}
          />
          <ActionCard
            icon={<Camera className="size-5" />}
            title="Agregar con camara"
            onClick={() => setCameraModalOpen(true)}
          />
        </div>

        <div className="space-y-4">
          <Panel className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto o nota"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 lg:w-[370px]">
                <FilterButton
                  active={activeArea === 'all'}
                  onClick={() => setActiveArea('all')}
                >
                  Todos
                </FilterButton>
                <FilterButton
                  active={activeArea === 'fridge'}
                  onClick={() => setActiveArea('fridge')}
                >
                  Frio
                </FilterButton>
                <FilterButton
                  active={activeArea === 'pantry'}
                  onClick={() => setActiveArea('pantry')}
                >
                  Despensa
                </FilterButton>
              </div>
            </div>
          </Panel>

          <div className="grid gap-3">
            {loadingProducts ? (
              <Panel className="flex min-h-56 items-center justify-center text-center">
                <div>
                  <Sparkles className="mx-auto mb-3 size-8 animate-pulse text-primary" />
                  <h2 className="font-semibold">Cargando inventario</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Leyendo productos desde SQLite.
                  </p>
                </div>
              </Panel>
            ) : (
              filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onRemove={() => removeProductById(product.id)}
                />
              ))
            )}

            {!loadingProducts && !filteredProducts.length ? (
              <Panel className="flex min-h-56 items-center justify-center text-center">
                <div>
                  <ChefHat className="mx-auto mb-3 size-8 text-muted-foreground" />
                  <h2 className="font-semibold">No hay productos aqui</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cambia el filtro o agrega uno nuevo desde el formulario.
                  </p>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </section>

      <Modal
        title="Agregar producto"
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
      >
        <div className="grid gap-4">
          <Field label="Producto" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="Leche, atun, verduras..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ubicacion">
              <Select
                value={form.area}
                onValueChange={(value) =>
                  updateForm('area', value as StorageArea)
                }
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
                value={form.quantity}
                onChange={(event) => updateForm('quantity', event.target.value)}
                placeholder="1 bolsa"
              />
            </Field>
          </div>

          <Field label="Vencimiento" htmlFor="expiresAt">
            <Input
              id="expiresAt"
              type="date"
              value={form.expiresAt}
              onChange={(event) => updateForm('expiresAt', event.target.value)}
            />
          </Field>

          <Field label="Notas" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="Lugar, marca, estado o cualquier detalle util."
            />
          </Field>

          <Button
            className="w-full"
            disabled={!form.name.trim() || !form.expiresAt || savingProduct}
            onClick={() => addProduct(aiStatus === 'ready' ? 'ai' : 'manual')}
          >
            <Check className="size-4" />
            {savingProduct ? 'Guardando...' : 'Guardar producto'}
          </Button>

          {saveError ? (
            <p className="text-sm text-destructive">{saveError}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        title="Agregar con camara"
        open={cameraModalOpen}
        onClose={() => {
          closeCamera()
          setCameraModalOpen(false)
        }}
      >
        <div className="grid gap-3">
          {scanPreview ? (
            <img
              alt="Foto analizada del producto"
              className="h-48 w-full rounded-md border border-border object-cover"
              src={scanPreview}
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted text-muted-foreground">
              <ImageUp className="size-8" />
            </div>
          )}

          {cameraOpen ? (
            <div className="grid gap-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-56 w-full rounded-md border border-border bg-black object-cover"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={capturePhoto}>
                  <Camera className="size-4" />
                  Capturar
                </Button>
                <Button variant="outline" onClick={closeCamera}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={openCamera}>
                <Camera className="size-4" />
                Camara
              </Button>
              <Label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                <Upload className="size-4" />
                Subir
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleUpload}
                />
              </Label>
            </div>
          )}

          {cameraError ? (
            <p className="text-sm text-destructive">{cameraError}</p>
          ) : null}

          <AiStatus status={aiStatus} />
        </div>
      </Modal>
    </main>
  )
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

function ActionCard({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      className="flex min-h-20 items-center gap-2 rounded-lg border border-border bg-card p-3 text-left text-card-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-24 sm:gap-4 sm:p-5"
      onClick={onClick}
      type="button"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground sm:size-11">
        {icon}
      </span>
      <span className="text-sm font-semibold leading-tight sm:text-base">
        {title}
      </span>
    </button>
  )
}

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <section
        aria-modal="true"
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            aria-label="Cerrar"
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </section>
    </div>
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
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'urgent'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-3',
        tone === 'urgent' && 'border-destructive/30 bg-destructive/10',
      )}
    >
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'h-9 rounded-md border border-border px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function ProductRow({
  product,
  onRemove,
}: {
  product: Product
  onRemove: () => void
}) {
  const freshness = getFreshness(product.expiresAt)
  const Icon = product.area === 'fridge' ? Refrigerator : Warehouse

  return (
    <Panel className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold">
                {product.name}
              </h3>
              {product.source === 'ai' ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-foreground">
                  <Sparkles className="size-3" />
                  IA
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.quantity} ·{' '}
              {product.area === 'fridge' ? 'Refrigeradora' : 'Despensa'}
            </p>
            {product.notes ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.notes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
              freshness.className,
            )}
          >
            {freshness.icon}
            <span>{freshness.label}</span>
          </div>
          <Button
            aria-label={`Eliminar ${product.name}`}
            variant="ghost"
            size="icon"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function AiStatus({
  status,
}: {
  status: 'idle' | 'analyzing' | 'ready' | 'needs-review'
}) {
  if (status === 'idle') {
    return (
      <p className="text-sm text-muted-foreground">
        La lectura con IA debe confirmarse antes de guardar.
      </p>
    )
  }

  if (status === 'analyzing') {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse text-primary" />
        Analizando foto...
      </p>
    )
  }

  if (status === 'ready') {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-foreground">
        <Check className="size-4 text-primary" />
        Datos sugeridos listos para revisar.
      </p>
    )
  }

  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <AlertTriangle className="size-4 text-destructive" />
      No se detecto una fecha clara; completala manualmente.
    </p>
  )
}

function getFreshness(expiresAt: string) {
  const days = differenceInDays(parseLocalDate(expiresAt), startOfToday())

  if (days < 0) {
    return {
      label: `Vencio hace ${Math.abs(days)} d`,
      className: 'border-destructive/30 bg-destructive/10 text-foreground',
      icon: <AlertTriangle className="size-4 text-destructive" />,
    }
  }

  if (days <= 2) {
    return {
      label: days === 0 ? 'Vence hoy' : `Vence en ${days} d`,
      className: 'border-destructive/30 bg-destructive/10 text-foreground',
      icon: <AlertTriangle className="size-4 text-destructive" />,
    }
  }

  if (days <= 7) {
    return {
      label: `Vence en ${days} d`,
      className: 'border-primary/35 bg-primary/10 text-foreground',
      icon: <Clock3 className="size-4 text-primary" />,
    }
  }

  return {
    label: `Vence en ${days} d`,
    className: 'border-border bg-background text-muted-foreground',
    icon: <Clock3 className="size-4" />,
  }
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function differenceInDays(a: Date, b: Date) {
  const dayMs = 1000 * 60 * 60 * 24
  return Math.round((a.getTime() - b.getTime()) / dayMs)
}

async function normalizeImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()

    const maxSide = 1800
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    context?.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', 0.86)
  } catch {
    return readFileAsDataUrl(file)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
