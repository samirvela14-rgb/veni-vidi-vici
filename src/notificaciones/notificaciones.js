import { supabase } from '../supabaseClient'

// Llave pública VAPID (es pública a propósito; la privada vive solo en los secretos de Supabase)
const LLAVE_PUBLICA = 'BLdqELtytUILqHmmA0K1N8n7VqMcEE61Yh7YFlHbzJE_ijusEoZZdZsqu3l5J7yxpmlsr_1Bod6_UydXh1H8h6A'

function aBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export function soportaNotificaciones() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registro() {
  // En desarrollo no se registra el service worker automáticamente: aquí sí, para poder probar
  return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('/sw.js')
}

export async function estadoNotificaciones() {
  if (!soportaNotificaciones()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'activo' : 'inactivo'
}

function nombreDispositivo() {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad/i.test(ua)) return 'iPhone'
  if (/windows/i.test(ua)) return 'PC Windows'
  if (/mac/i.test(ua)) return 'Mac'
  return 'Navegador'
}

export async function activarNotificaciones() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('No diste permiso para las notificaciones.')
  const reg = await registro()
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(LLAVE_PUBLICA) })
  const json = sub.toJSON()
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase.from('push_suscripciones').upsert({
    user_id: session.user.id,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    dispositivo: nombreDispositivo(),
  }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function desactivarNotificaciones() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

// Notificación de prueba local (no pasa por el servidor): confirma que el teléfono las muestra
export async function probarNotificacion() {
  const reg = await registro()
  await navigator.serviceWorker.ready
  await reg.showNotification('Veni, Vidi, Vici', {
    body: 'Así te llegarán los avisos. A las 7 am, tu día; 15 min antes, cada tarea.',
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
  })
}
