// Service worker de Veni, Vidi, Vici
// - La app abre aunque no haya internet (guarda la última versión que cargó)
// - Guarda la última copia de tus datos de Supabase para verlos sin conexión
// - Recibe las notificaciones (resumen de las 7 am y avisos de tareas)
// Al cambiar este archivo, sube la versión para que se renueven los cachés.
const VERSION = 'v2'
const CACHE_APP = `vvv-app-${VERSION}`
const CACHE_DATOS = `vvv-datos-${VERSION}`
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.webp', '/icon-512.webp', '/fondo-hero.jpg', '/favicon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Red primero; si no hay internet, lo último guardado
async function redPrimero(request, cache) {
  try {
    const respuesta = await fetch(request)
    if (respuesta.ok) (await caches.open(cache)).put(request, respuesta.clone())
    return respuesta
  } catch (err) {
    const guardada = await caches.match(request)
    if (guardada) return guardada
    throw err
  }
}

// Caché primero (archivos con nombre único por versión: JS, CSS, fuentes)
async function cachePrimero(request) {
  const guardada = await caches.match(request)
  if (guardada) return guardada
  const respuesta = await fetch(request)
  // Las fuentes de Google llegan "opacas" (sin poder leer su estado): también se guardan
  if (respuesta.ok || respuesta.type === 'opaque') (await caches.open(CACHE_APP)).put(request, respuesta.clone())
  return respuesta
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Páginas: red primero, y sin internet la app guardada
  if (request.mode === 'navigate') {
    e.respondWith(redPrimero(request, CACHE_APP).catch(() => caches.match('/index.html')))
    return
  }
  // Datos de Supabase (solo lecturas): red primero, sin internet la última copia
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    e.respondWith(redPrimero(request, CACHE_DATOS))
    return
  }
  // Archivos de la app y fuentes de Google
  if ((url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cachePrimero(request))
    return
  }
  if (url.origin === self.location.origin && !url.pathname.startsWith('/api/')) {
    e.respondWith(redPrimero(request, CACHE_APP))
  }
})

// ---------- Notificaciones ----------
self.addEventListener('push', (e) => {
  let datos = {}
  try { datos = e.data ? e.data.json() : {} } catch { datos = { cuerpo: e.data?.text() } }
  const titulo = datos.titulo || 'Veni, Vidi, Vici'
  e.waitUntil(self.registration.showNotification(titulo, {
    body: datos.cuerpo || '',
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
    tag: datos.etiqueta || undefined,
    data: { url: datos.url || '/' },
    lang: 'es',
  }))
})

// Al tocar la notificación: abre la app (o la trae al frente) en la pantalla indicada
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin) {
        await v.focus()
        v.navigate(destino)
        return
      }
    }
    await self.clients.openWindow(destino)
  })())
})
