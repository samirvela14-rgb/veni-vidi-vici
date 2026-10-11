import { supabase } from '../supabaseClient'
import { otorgarXP, quitarXP } from '../xp'

// Cola de cambios hechos sin internet (gastos, hábitos, tareas).
// - Se guarda en el teléfono (IndexedDB) y se envía sola al volver la conexión.
// - Cada registro nuevo lleva un id (UUID) creado aquí: si se envía dos veces,
//   Supabase lo reconoce y no lo duplica. Esto también protege del doble toque con internet lento.
// - El XP de cada cambio se da solo cuando el registro de verdad se guardó.

const BD = 'vvv-offline'
const ALMACEN = 'cola'

function abrirBD() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BD, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN, { keyPath: 'id' })
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

async function conAlmacen(modo, fn) {
  const bd = await abrirBD()
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(ALMACEN, modo)
    const resultado = fn(tx.objectStore(ALMACEN))
    tx.oncomplete = () => resolve(resultado?.result ?? resultado)
    tx.onerror = () => reject(tx.error)
  })
}

const leerCola = () => conAlmacen('readonly', (a) => a.getAll())
const guardarEnCola = (op) => conAlmacen('readwrite', (a) => a.put(op))
const quitarDeCola = (id) => conAlmacen('readwrite', (a) => a.delete(id))

function avisarCambio(detalle = {}) {
  leerCola().then((cola) => {
    window.dispatchEvent(new CustomEvent('vvv-cola', { detail: { pendientes: cola.length, ...detalle } }))
  }).catch(() => {})
}

export const pendientesEnCola = () => leerCola().then((c) => c.length).catch(() => 0)

function esErrorDeRed(error) {
  if (!navigator.onLine) return true
  const texto = `${error?.message || ''} ${error?.details || ''}`
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(texto)
}

// Ejecuta una operación contra Supabase. Devuelve { error, guardado } (guardado = la fila se creó/cambió ahora)
async function correr(op) {
  const tabla = supabase.from(op.tabla)
  let r
  if (op.accion === 'insert') {
    r = await tabla.upsert(op.datos, { onConflict: 'id', ignoreDuplicates: true }).select('id')
    return { error: r.error, guardado: !r.error && (r.data?.length ?? 0) > 0 }
  }
  if (op.accion === 'update') r = await tabla.update(op.datos).match(op.filtro)
  else if (op.accion === 'delete') r = await tabla.delete().match(op.filtro)
  return { error: r?.error, guardado: !r?.error }
}

async function darXP(op) {
  for (const motivo of op.xp?.otorgar || []) await otorgarXP(motivo)
  for (const motivo of op.xp?.quitar || []) await quitarXP(motivo)
}

/**
 * Hace un cambio en Supabase, o lo guarda en la cola si no hay internet.
 * op = { tabla, accion: 'insert' | 'update' | 'delete', datos?, filtro?, xp?: { otorgar?: [], quitar?: [] } }
 * Devuelve { ok, pendiente, error }.
 */
export async function ejecutar(op) {
  const conId = { ...op, id: crypto.randomUUID(), creado: Date.now() }
  if (!navigator.onLine) {
    await guardarEnCola(conId)
    avisarCambio()
    return { ok: true, pendiente: true }
  }
  const { error, guardado } = await correr(conId)
  if (error) {
    if (esErrorDeRed(error)) {
      await guardarEnCola(conId)
      avisarCambio()
      return { ok: true, pendiente: true }
    }
    return { ok: false, error: error.message }
  }
  if (guardado) await darXP(conId)
  return { ok: true, pendiente: false }
}

let sincronizando = null

// Envía todo lo pendiente, en el orden en que se hizo. Si se vuelve a caer el internet, para y espera.
export function sincronizar() {
  if (sincronizando) return sincronizando
  sincronizando = (async () => {
    let enviados = 0
    const fallidos = []
    const cola = (await leerCola().catch(() => [])).sort((a, b) => a.creado - b.creado)
    for (const op of cola) {
      if (!navigator.onLine) break
      const { error, guardado } = await correr(op)
      if (error && esErrorDeRed(error)) break
      if (error) fallidos.push(`${op.tabla}: ${error.message}`)
      else {
        enviados++
        if (guardado) await darXP(op)
      }
      await quitarDeCola(op.id)
    }
    avisarCambio({ enviados, fallidos })
    return { enviados, fallidos }
  })().finally(() => { sincronizando = null })
  return sincronizando
}

// Al volver la conexión (y al abrir la app) se envía lo pendiente
export function iniciarSincronizacion() {
  window.addEventListener('online', () => { sincronizar() })
  if (navigator.onLine) sincronizar()
  else avisarCambio()
}
