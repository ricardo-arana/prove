# API — Productos

Endpoints HTTP REST para listar productos por vencer/vencidos y para agregar
productos nuevos.

- [`GET /api/products/expiring`](#get-apiproductsexpiring) — por vencer / vencidos.
- [`POST /api/products`](#post-apiproducts) — agregar producto.

---

## GET /api/products/expiring

Devuelve los productos que **vencen dentro de un rango de fechas** y los que
**ya vencieron** hasta la fecha de hoy.

```
GET /api/products/expiring
```

## Parámetros (query string)

| Parámetro | Requerido | Formato      | Descripción                                  |
| --------- | --------- | ------------ | -------------------------------------------- |
| `start`   | Sí        | `YYYY-MM-DD` | Inicio del rango de vencimiento (inclusive). |
| `end`     | Sí        | `YYYY-MM-DD` | Fin del rango de vencimiento (inclusive).    |

Reglas:

- Ambos parámetros son obligatorios y deben tener formato `YYYY-MM-DD`.
- `start` debe ser menor o igual que `end`.

## Qué devuelve

Una lista plana de productos que cumplen **cualquiera** de estas condiciones:

1. **Ya vencidos**: `expiresAt` es anterior a hoy (sin importar el rango).
2. **Por vencer en el rango**: `expiresAt` está entre `start` y `end` (inclusive).

Cada producto incluye un campo `status`:

- `"expired"` — venció antes de hoy.
- `"expiring"` — vence hoy o dentro del rango.

Los resultados vienen ordenados por `expiresAt` ascendente.

### Estructura de la respuesta

```json
{
  "today": "2026-06-28",
  "count": 2,
  "products": [
    {
      "id": "1a932c76-ee0a-4f66-a6cb-bde0c35c19cd",
      "name": "Danlac leche entera pasteurizada",
      "area": "fridge",
      "expiresAt": "2026-05-29",
      "quantity": "1 unidad",
      "notes": "...",
      "source": "ai",
      "createdAt": "2026-05-31 10:42:00",
      "status": "expired"
    },
    {
      "id": "8c0f...",
      "name": "Yogurt griego",
      "area": "fridge",
      "expiresAt": "2026-07-01",
      "quantity": "2",
      "notes": "",
      "source": "manual",
      "createdAt": "2026-06-20 09:00:00",
      "status": "expiring"
    }
  ]
}
```

| Campo               | Tipo               | Descripción                               |
| ------------------- | ------------------ | ----------------------------------------- |
| `today`             | string             | Fecha del servidor usada como corte (UTC).|
| `count`             | number             | Cantidad de productos devueltos.          |
| `products`          | array              | Lista de productos.                       |
| `products[].status` | `expired`/`expiring` | Estado calculado contra `today`.        |

(Los demás campos de cada producto son los del registro: `id`, `name`, `area`
`'fridge' | 'pantry'`, `expiresAt`, `quantity`, `notes`, `source`
`'manual' | 'ai'`, `createdAt`. La imagen (`imageUrl`) no se incluye.)

## Ejemplos

### Petición correcta

```bash
curl 'http://localhost:3200/api/products/expiring?start=2026-06-27&end=2026-07-10'
```

### JavaScript (fetch)

```js
const params = new URLSearchParams({ start: '2026-06-27', end: '2026-07-10' })
const res = await fetch(`/api/products/expiring?${params}`)
const { products } = await res.json()
```

## Errores

| Código | Cuándo                                              | Cuerpo                                                                 |
| ------ | -------------------------------------------------- | --------------------------------------------------------------------- |
| `400`  | Falta `start`/`end` o formato distinto de `YYYY-MM-DD` | `{ "error": "Parámetros inválidos. Requiere start y end (YYYY-MM-DD)." }` |
| `400`  | `start` mayor que `end`                             | `{ "error": "start debe ser <= end" }`                                |

```bash
curl -i 'http://localhost:3200/api/products/expiring?start=foo'
# HTTP/1.1 400 Bad Request
# {"error":"Parámetros inválidos. Requiere start y end (YYYY-MM-DD)."}
```

### Notas

- El corte `today` se calcula en el servidor en UTC.
- Un producto dentro del rango pero con fecha anterior a hoy se reporta como
  `expired` (el estado manda sobre el rango).

---

## POST /api/products

Agrega un producto nuevo. El `id` lo genera el servidor (no se envía).

```
POST /api/products
Content-Type: application/json
```

### Cuerpo (JSON)

| Campo       | Requerido | Tipo / valores         | Default     | Descripción                       |
| ----------- | --------- | ---------------------- | ----------- | --------------------------------- |
| `name`      | Sí        | string                 | —           | Nombre del producto.              |
| `area`      | Sí        | `"fridge"` \| `"pantry"` | —         | Ubicación.                        |
| `expiresAt` | Sí        | string `YYYY-MM-DD`    | —           | Fecha de vencimiento.             |
| `quantity`  | Sí        | string                 | —           | Cantidad (texto libre, ej `"2"`). |
| `notes`     | No        | string                 | `""`        | Notas.                            |
| `source`    | No        | `"manual"` \| `"ai"`   | `"manual"`  | Origen del registro.              |
| `imageUrl`  | No        | string                 | —           | Imagen (no se devuelve).          |

### Respuesta `201 Created`

Devuelve el producto creado (sin `imageUrl`):

```json
{
  "product": {
    "id": "15c85e48-5750-49a6-b3fe-275afe76f3c2",
    "name": "Yogurt griego",
    "area": "fridge",
    "expiresAt": "2026-07-05",
    "quantity": "2",
    "notes": "",
    "source": "manual",
    "createdAt": "2026-06-28 04:41:58"
  }
}
```

### Ejemplos

```bash
curl -X POST 'http://localhost:3200/api/products' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Yogurt griego","area":"fridge","expiresAt":"2026-07-05","quantity":"2"}'
```

```js
const res = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Yogurt griego',
    area: 'fridge',
    expiresAt: '2026-07-05',
    quantity: '2',
  }),
})
const { product } = await res.json()
```

### Errores

| Código | Cuándo                              | Cuerpo                                                    |
| ------ | ----------------------------------- | -------------------------------------------------------- |
| `400`  | Body no es JSON válido              | `{ "error": "Body debe ser JSON válido." }`              |
| `400`  | Falta un campo o tiene tipo inválido | `{ "error": "Datos inválidos.", "issues": [ ... ] }`    |
| `500`  | No se pudo crear el producto        | `{ "error": "No se pudo crear el producto." }`           |

`issues` es el detalle de validación de Zod (qué campo falló y por qué).
