import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.VITE_BASE ?? (repository ? `/${repository}/` : '/')

function staticCachePlugin(): Plugin {
  return {
    name: 'sql-lab-static-cache',
    apply: 'build',
    async closeBundle() {
      const output = path.resolve('dist')
      const files = (await readdir(output, { recursive: true })).filter((file) => /\.(?:js|css|wasm|html|svg|png|woff2?|ttf)$/.test(file)).sort()
      const hash = createHash('sha256')
      for (const file of files) {
        hash.update(file)
        hash.update(await readFile(path.join(output, file)))
      }
      const cacheName = `sql-lab-${hash.digest('hex').slice(0, 16)}`
      const worker = `const CACHE = ${JSON.stringify(cacheName)}
const PRECACHE = ${JSON.stringify(files)}
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sql-lab-') && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]))
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('index.html', self.registration.scope).toString())))
    return
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  })))
})
`
      await writeFile(path.join(output, 'sw.js'), worker)
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), staticCachePlugin()],
  optimizeDeps: {
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-tools'],
  },
  worker: {
    format: 'es',
  },
  build: {
    manifest: true,
  },
})
