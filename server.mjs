import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { Readable } from 'node:stream'

import app from './dist/server/server.js'

const port = Number(process.env.PORT ?? 3200)
const host = process.env.HOST ?? '0.0.0.0'
const clientDir = join(process.cwd(), 'dist', 'client')

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    if (serveStaticFile(req, res)) return

    const request = toRequest(req)
    const response = await app.fetch(request)

    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    if (!response.body) {
      res.end()
      return
    }

    Readable.fromWeb(response.body).pipe(res)
  } catch (error) {
    console.error(error)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

server.listen(port, host, () => {
  console.log(`Prove listening on http://${host}:${port}`)
})

function serveStaticFile(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)
  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = join(clientDir, safePath)

  if (!filePath.startsWith(clientDir) || !existsSync(filePath)) return false

  const stat = statSync(filePath)
  if (!stat.isFile()) return false

  res.statusCode = 200
  res.setHeader(
    'content-type',
    contentTypes[extname(filePath)] ?? 'application/octet-stream',
  )
  res.setHeader('content-length', stat.size)
  createReadStream(filePath).pipe(res)
  return true
}

function toRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] ?? 'http'
  const hostHeader = req.headers.host ?? `localhost:${port}`
  const url = `${protocol}://${hostHeader}${req.url ?? '/'}`
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
      continue
    }

    if (value !== undefined) headers.set(key, value)
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  })
}
