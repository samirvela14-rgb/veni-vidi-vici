import { supabase } from '../supabaseClient'
import { hoyISO } from '../fechas'
import { XP_TABLA } from '../xp'
import { cobrarBono } from './economia'

function mesAnterior() {
  const [a, m] = hoyISO().split('-').map(Number)
  const d = new Date(a, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Al empezar un mes, revisa el anterior: si hubo ingresos y se cumplieron
// las reglas (ahorro mínimo y entretenimiento máximo), paga +300 XP una sola vez.
// Devuelve { mes, ahorroPct, entretenimientoPct } si se pagó ahora, o null.
export async function revisarBonoFinanzas() {
  const mes = mesAnterior()
  const clave = `finanzas-${mes}`
  const ya = await supabase.from('bonos').select('id').eq('clave', clave).maybeSingle()
  if (ya.error || ya.data) return null

  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const [trs, conf] = await Promise.all([
    supabase.from('transacciones').select('tipo, monto, categoria').gte('fecha', `${mes}-01`).lte('fecha', `${mes}-${ultimo}`),
    supabase.from('presupuesto_config').select('ahorro_minimo_pct, entretenimiento_max_pct').maybeSingle(),
  ])
  if (trs.error || !trs.data?.length) return null

  const suma = (fn) => trs.data.filter(fn).reduce((s, t) => s + Number(t.monto), 0)
  const ingresos = suma((t) => t.tipo === 'ingreso')
  if (!ingresos) return null
  const ahorroPct = (suma((t) => t.tipo === 'gasto' && t.categoria === 'Ahorro') / ingresos) * 100
  const entretenimientoPct = (suma((t) => t.tipo === 'gasto' && t.categoria === 'Entretenimiento') / ingresos) * 100
  const reglas = conf.data || { ahorro_minimo_pct: 20, entretenimiento_max_pct: 15 }

  const cumple = ahorroPct >= Number(reglas.ahorro_minimo_pct) && entretenimientoPct <= Number(reglas.entretenimiento_max_pct)
  if (!cumple) return null
  const pagado = await cobrarBono(clave, { xp: XP_TABLA.finanzas_mes })
  return pagado ? { mes, ahorroPct: Math.round(ahorroPct), entretenimientoPct: Math.round(entretenimientoPct) } : null
}
