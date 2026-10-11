import { supabase } from '../supabaseClient'
import { hoyISO, sumarDias, fechaLocal } from '../fechas'

// Lunes de la semana de una fecha (las semanas del juego van de lunes a domingo)
export function lunesDe(fechaISO = hoyISO()) {
  const d = new Date(fechaISO + 'T00:00:00')
  const desdeLunes = (d.getDay() + 6) % 7
  return sumarDias(fechaISO, -desdeLunes)
}

export function rangoDias(desde, hasta) {
  const dias = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f)
  return dias
}

// Qué hábitos contaban en una fecha (si cambiaste tu lista, el pasado se respeta)
export function habitosActivosEn(habitos, fecha) {
  return habitos.filter((h) => {
    const creado = fechaLocal(h.creado_en)
    const desactivado = fechaLocal(h.desactivado_en)
    if (creado && creado > fecha) return false
    if (desactivado && desactivado <= fecha) return false
    if (!h.desactivado_en && h.activo === false) return false
    return true
  })
}

// Devuelve una función que dice si un día fue perfecto.
// Los días protegidos o de descanso cuentan como perfectos (no rompen la racha).
export function crearDiaPerfecto(habitos, registros, especiales = []) {
  const marcados = new Set(registros.map((r) => `${r.habito_id}|${r.fecha}`))
  const especialesPorFecha = new Map(especiales.map((e) => [e.fecha, e.tipo]))
  return (fecha) => {
    if (especialesPorFecha.has(fecha)) return true
    const activos = habitosActivosEn(habitos, fecha)
    return activos.length > 0 && activos.every((h) => marcados.has(`${h.id}|${fecha}`))
  }
}

// Racha actual (hoy en curso no la rompe) y mejor racha en los días dados
export function calcularRachas(dias, diaPerfecto) {
  let mejor = 0, temp = 0
  dias.forEach((f) => {
    if (diaPerfecto(f)) { temp++; mejor = Math.max(mejor, temp) } else temp = 0
  })
  let actual = 0
  const hoy = hoyISO()
  for (let i = dias.length - 1; i >= 0; i--) {
    if (diaPerfecto(dias[i])) actual++
    else if (dias[i] === hoy) continue
    else break
  }
  return { mejor, actual }
}

// Protector automático: si ayer o anteayer fallaste y tienes protectores guardados, se usan solos.
// Devuelve las fechas que se protegieron.
export async function aplicarProtectores() {
  const hoy = hoyISO()
  const candidatos = [sumarDias(hoy, -2), sumarDias(hoy, -1)]
  const [hab, regs, esp, prot] = await Promise.all([
    supabase.from('habitos').select('id, creado_en, desactivado_en, activo'),
    supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', candidatos[0]).lte('fecha', candidatos[1]),
    supabase.from('dias_especiales').select('fecha, tipo').gte('fecha', candidatos[0]),
    supabase.from('compras').select('id').eq('clave', 'protector').is('usado_en', null).order('creado_en'),
  ])
  if (hab.error || esp.error || prot.error) return []
  const disponibles = [...(prot.data || [])]
  const diaPerfecto = crearDiaPerfecto(hab.data || [], regs.data || [], esp.data || [])
  const protegidas = []
  for (const fecha of candidatos) {
    if (!disponibles.length) break
    if (diaPerfecto(fecha) || habitosActivosEn(hab.data || [], fecha).length === 0) continue
    const { error } = await supabase.from('dias_especiales').insert({ fecha, tipo: 'protector' })
    if (error) continue
    const compra = disponibles.shift()
    await supabase.from('compras').update({ usado_en: new Date().toISOString() }).eq('id', compra.id)
    protegidas.push(fecha)
  }
  return protegidas
}
