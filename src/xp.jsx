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
}

export async function otorgarXP(motivo) {
  const cantidad = XP_TABLA[motivo] ?? 0
  if (!cantidad) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.rpc('otorgar_xp', { p_user_id: user.id, p_cantidad: cantidad })
}

export async function quitarXP(motivo) {
  const cantidad = XP_TABLA[motivo] ?? 0
  if (!cantidad) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.rpc('otorgar_xp', { p_user_id: user.id, p_cantidad: -cantidad })
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

export async function ajustarXP(cantidad) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.rpc('otorgar_xp', { p_user_id: user.id, p_cantidad: cantidad })
}