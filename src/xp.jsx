import { supabase } from './supabaseClient'

export const XP_TABLA = {
  habito: 10,
  dia_perfecto: 50,
  journal: 15,
  journal_buen_dia: 20, // bono si Jarvis puntúa 8 o más
  palabra: 15,
  meta_completada: 150,
  meta_actualizada: 10,
  proyecto_etapa: 25,
  proyecto_completado: 100,
  tarea: 5,
  tarea_a_tiempo: 10, // extra si la terminas antes de su fecha límite
  movimiento: 1, // cada gasto o ingreso registrado en Finanzas
  finanzas_mes: 300, // cerrar el mes cumpliendo tus reglas de presupuesto
}

// El poder "Doble XP" dura 24 horas desde que se compra.
// Se consulta como mucho una vez por minuto para no llenar de consultas.
let dobleCache = { hasta: 0, revisado: 0 }

export async function dobleXPHasta() {
  if (Date.now() - dobleCache.revisado < 60_000) return dobleCache.hasta
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase.from('compras').select('creado_en')
    .eq('clave', 'doble_xp').gte('creado_en', desde)
    .order('creado_en', { ascending: false }).limit(1).maybeSingle()
  const hasta = data ? new Date(data.creado_en).getTime() + 24 * 60 * 60 * 1000 : 0
  dobleCache = { hasta, revisado: Date.now() }
  return hasta
}

export function olvidarDobleXP() {
  dobleCache = { hasta: 0, revisado: 0 }
}

async function multiplicador() {
  return (await dobleXPHasta()) > Date.now() ? 2 : 1
}

export async function ajustarXP(cantidad) {
  if (!cantidad) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.rpc('otorgar_xp', { p_user_id: user.id, p_cantidad: cantidad })
}

export async function otorgarXP(motivo) {
  const cantidad = XP_TABLA[motivo] ?? 0
  if (!cantidad) return
  await ajustarXP(cantidad * (await multiplicador()))
}

export async function quitarXP(motivo) {
  const cantidad = XP_TABLA[motivo] ?? 0
  if (!cantidad) return
  await ajustarXP(-cantidad * (await multiplicador()))
}

export const TITULOS = [
  { nivelMin: 1, nombre: 'Aprendiz' },
  { nivelMin: 10, nombre: 'Disciplinado' },
  { nivelMin: 25, nombre: 'Estratega' },
  { nivelMin: 50, nombre: 'Vici' },
]

export function tituloPorNivel(nivel) {
  return [...TITULOS].reverse().find((t) => nivel >= t.nivelMin)?.nombre || 'Aprendiz'
}
