import { supabase } from '../supabaseClient'
import { hoyISO, sumarDias } from '../fechas'
import { lunesDe } from './dias'

const contar = (q) => q.then((r) => (r.error ? 0 : r.count || 0))
const filas = (q) => q.then((r) => (r.error ? [] : r.data || []))

// Todo lo que necesitan los logros, los objetivos semanales y la tienda, en una sola tanda
export async function traerDatosJuego() {
  const { data: { user } } = await supabase.auth.getUser()
  const hoy = hoyISO()
  const lunes = lunesDe(hoy)
  const hace400 = sumarDias(hoy, -400)

  const [
    perfil, habitos, registros, especiales, journal, palabra,
    tareasHechas, tareasSemana, etapasHechas, etapasSemana, proyectosTerminados,
    metasLogradas, metasFinLogradas, deudasPagadas, movimientos, movimientosSemana,
    bonos, compras, logros, ajustes, recompensas,
  ] = await Promise.all([
    supabase.from('perfil').select('xp, nivel').eq('user_id', user.id).maybeSingle().then((r) => r.data || { xp: 0, nivel: 1 }),
    filas(supabase.from('habitos').select('id, creado_en, desactivado_en, activo')),
    filas(supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', hace400)),
    filas(supabase.from('dias_especiales').select('fecha, tipo').gte('fecha', hace400)),
    filas(supabase.from('journal_entradas').select('fecha')),
    filas(supabase.from('palabra_entradas').select('fecha')),
    contar(supabase.from('tarjetas').select('id', { count: 'exact', head: true }).not('completada_en', 'is', null)),
    filas(supabase.from('tarjetas').select('completada_en').gte('completada_en', `${lunes}T00:00:00`)),
    contar(supabase.from('proyecto_etapas').select('id', { count: 'exact', head: true }).eq('hecha', true)),
    filas(supabase.from('proyecto_etapas').select('hecha_en').eq('hecha', true).gte('hecha_en', `${lunes}T00:00:00`)),
    contar(supabase.from('proyectos').select('id', { count: 'exact', head: true }).eq('estado', 'terminado')),
    contar(supabase.from('metas').select('id', { count: 'exact', head: true }).eq('completada', true)),
    contar(supabase.from('metas_financieras').select('id', { count: 'exact', head: true }).eq('completada', true).neq('tipo', 'deuda')),
    contar(supabase.from('metas_financieras').select('id', { count: 'exact', head: true }).eq('completada', true).eq('tipo', 'deuda')),
    contar(supabase.from('transacciones').select('id', { count: 'exact', head: true })),
    filas(supabase.from('transacciones').select('fecha').gte('fecha', lunes)),
    filas(supabase.from('bonos').select('clave, xp, monedas, creado_en')),
    filas(supabase.from('compras').select('*').order('creado_en', { ascending: false })),
    filas(supabase.from('logros').select('clave, desbloqueado_en')),
    supabase.from('ajustes_jugador').select('*').maybeSingle().then((r) => r.data || {}),
    filas(supabase.from('recompensas').select('*').order('creado_en')),
  ])

  // Si falta el SQL de desactivado_en, se usan solo los hábitos activos
  const habitosOk = habitos.length ? habitos : await filas(supabase.from('habitos').select('id, creado_en, activo').eq('activo', true))

  return {
    hoy, lunes, perfil,
    habitos: habitosOk, registros, especiales,
    journal: journal.map((j) => j.fecha), palabra: palabra.map((p) => p.fecha),
    tareasHechas, tareasSemana, etapasHechas, etapasSemana, proyectosTerminados,
    metasLogradas: metasLogradas + metasFinLogradas, deudasPagadas,
    movimientos, movimientosSemana: movimientosSemana.map((m) => m.fecha),
    bonos, compras, logros, ajustes, recompensas,
  }
}
