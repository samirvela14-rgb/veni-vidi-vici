import { supabase } from '../supabaseClient'
import { cobrarBono } from './economia'
import { crearDiaPerfecto, calcularRachas, rangoDias } from './dias'

export const RAREZAS = {
  bronce: { emoji: '🥉', monedas: 5, label: 'Bronce' },
  plata: { emoji: '🥈', monedas: 20, label: 'Plata' },
  oro: { emoji: '🥇', monedas: 60, label: 'Oro' },
}

// Racha más larga de días seguidos dentro de una lista de fechas
function mejorRachaFechas(fechas) {
  const unicas = [...new Set(fechas)].sort()
  let mejor = 0, temp = 0, anterior = null
  unicas.forEach((f) => {
    const sigue = anterior && (new Date(f + 'T00:00:00') - new Date(anterior + 'T00:00:00')) === 86400000
    temp = sigue ? temp + 1 : 1
    mejor = Math.max(mejor, temp)
    anterior = f
  })
  return mejor
}

// Meses seguidos cumpliendo las reglas de finanzas (según los bonos cobrados)
function mesesSeguidosFinanzas(bonos) {
  const meses = bonos.filter((b) => b.clave.startsWith('finanzas-')).map((b) => b.clave.slice(9)).sort()
  let mejor = 0, temp = 0, anterior = null
  meses.forEach((m) => {
    const [a, mm] = m.split('-').map(Number)
    const sigue = anterior && (a * 12 + mm) - anterior === 1
    temp = sigue ? temp + 1 : 1
    mejor = Math.max(mejor, temp)
    anterior = a * 12 + mm
  })
  return mejor
}

// Cada logro mide su avance con los datos del juego: { actual, meta }
export const CATALOGO = [
  // Hábitos
  { clave: 'primer_dia_perfecto', area: 'Hábitos', rareza: 'bronce', titulo: 'Primer día perfecto', descripcion: 'Completa todos tus hábitos en un día', medir: (c) => [c.diasPerfectos, 1] },
  { clave: 'racha_7', area: 'Hábitos', rareza: 'plata', titulo: 'Una semana de hierro', descripcion: '7 días perfectos seguidos', medir: (c) => [c.mejorRacha, 7] },
  { clave: 'racha_30', area: 'Hábitos', rareza: 'oro', titulo: 'Un mes de hierro', descripcion: '30 días perfectos seguidos', medir: (c) => [c.mejorRacha, 30] },
  { clave: 'racha_100', area: 'Hábitos', rareza: 'oro', titulo: 'Imparable', descripcion: '100 días perfectos seguidos', medir: (c) => [c.mejorRacha, 100] },
  // Journal y Palabra
  { clave: 'journal_7', area: 'Journal y Palabra', rareza: 'bronce', titulo: 'Querido diario', descripcion: 'Escribe 7 entradas en tu journal', medir: (c, d) => [d.journal.length, 7] },
  { clave: 'journal_racha_7', area: 'Journal y Palabra', rareza: 'plata', titulo: 'Pluma constante', descripcion: 'Escribe 7 días seguidos', medir: (c, d) => [mejorRachaFechas(d.journal), 7] },
  { clave: 'journal_100', area: 'Journal y Palabra', rareza: 'oro', titulo: '100 páginas', descripcion: 'Escribe 100 entradas en tu journal', medir: (c, d) => [d.journal.length, 100] },
  { clave: 'palabra_7', area: 'Journal y Palabra', rareza: 'bronce', titulo: 'Primera semana con la Palabra', descripcion: 'Lee la Palabra 7 días', medir: (c, d) => [d.palabra.length, 7] },
  { clave: 'palabra_30', area: 'Journal y Palabra', rareza: 'plata', titulo: 'Un mes en la Palabra', descripcion: 'Lee la Palabra 30 días', medir: (c, d) => [d.palabra.length, 30] },
  { clave: 'palabra_100', area: 'Journal y Palabra', rareza: 'oro', titulo: 'Raíces profundas', descripcion: 'Lee la Palabra 100 días', medir: (c, d) => [d.palabra.length, 100] },
  // Tareas
  { clave: 'tarea_1', area: 'Tareas', rareza: 'bronce', titulo: 'Manos a la obra', descripcion: 'Completa tu primera tarea', medir: (c, d) => [d.tareasHechas, 1] },
  { clave: 'tareas_50', area: 'Tareas', rareza: 'plata', titulo: 'Máquina de pendientes', descripcion: 'Completa 50 tareas', medir: (c, d) => [d.tareasHechas, 50] },
  { clave: 'tareas_200', area: 'Tareas', rareza: 'oro', titulo: 'Nada se me escapa', descripcion: 'Completa 200 tareas', medir: (c, d) => [d.tareasHechas, 200] },
  // Proyectos y metas
  { clave: 'etapa_1', area: 'Proyectos y metas', rareza: 'bronce', titulo: 'Primer paso', descripcion: 'Completa la primera etapa de un proyecto', medir: (c, d) => [d.etapasHechas, 1] },
  { clave: 'proyecto_1', area: 'Proyectos y metas', rareza: 'plata', titulo: 'Proyecto terminado', descripcion: 'Termina tu primer proyecto', medir: (c, d) => [d.proyectosTerminados, 1] },
  { clave: 'proyectos_5', area: 'Proyectos y metas', rareza: 'oro', titulo: 'Constructor', descripcion: 'Termina 5 proyectos', medir: (c, d) => [d.proyectosTerminados, 5] },
  { clave: 'primera_meta', area: 'Proyectos y metas', rareza: 'bronce', titulo: 'Primera meta', descripcion: 'Logra tu primera meta', medir: (c, d) => [d.metasLogradas, 1] },
  { clave: 'metas_3', area: 'Proyectos y metas', rareza: 'oro', titulo: 'Veni, vidi, vici', descripcion: 'Logra 3 metas', medir: (c, d) => [d.metasLogradas, 3] },
  // Finanzas
  { clave: 'movimientos_30', area: 'Finanzas', rareza: 'bronce', titulo: 'Contador en formación', descripcion: 'Registra 30 movimientos', medir: (c, d) => [d.movimientos, 30] },
  { clave: 'mes_reglas', area: 'Finanzas', rareza: 'plata', titulo: 'Mes en orden', descripcion: 'Cierra un mes cumpliendo tus reglas de presupuesto', medir: (c) => [c.mesesSeguidos, 1] },
  { clave: 'deuda_pagada', area: 'Finanzas', rareza: 'plata', titulo: 'Libre de deudas', descripcion: 'Termina de pagar una deuda', medir: (c, d) => [d.deudasPagadas, 1] },
  { clave: 'meses_reglas_3', area: 'Finanzas', rareza: 'oro', titulo: 'Trimestre impecable', descripcion: '3 meses seguidos cumpliendo tus reglas', medir: (c) => [c.mesesSeguidos, 3] },
  // Nivel
  { clave: 'nivel_10', area: 'Nivel', rareza: 'bronce', titulo: 'Nivel 10', descripcion: 'Llega al nivel 10', medir: (c, d) => [d.perfil.nivel || 1, 10] },
  { clave: 'nivel_25', area: 'Nivel', rareza: 'plata', titulo: 'Nivel 25', descripcion: 'Llega al nivel 25', medir: (c, d) => [d.perfil.nivel || 1, 25] },
  { clave: 'nivel_50', area: 'Nivel', rareza: 'oro', titulo: 'Nivel 50', descripcion: 'Llega al nivel 50', medir: (c, d) => [d.perfil.nivel || 1, 50] },
]

export function evaluarLogros(d) {
  const diaPerfecto = crearDiaPerfecto(d.habitos, d.registros, d.especiales)
  const primerDia = [...d.registros.map((r) => r.fecha), ...d.especiales.map((e) => e.fecha)].sort()[0]
  const dias = primerDia ? rangoDias(primerDia, d.hoy) : []
  const comun = {
    diasPerfectos: dias.filter(diaPerfecto).length,
    mejorRacha: calcularRachas(dias, diaPerfecto).mejor,
    mesesSeguidos: mesesSeguidosFinanzas(d.bonos),
  }
  const tiene = new Set(d.logros.map((l) => l.clave))
  return CATALOGO.map((l) => {
    const [actual, meta] = l.medir(comun, d)
    return { ...l, actual: Math.min(actual, meta), meta, desbloqueado: tiene.has(l.clave), cumplido: actual >= meta }
  })
}

// Guarda los logros nuevos y paga sus monedas (también a los viejos que nunca pagaron)
export async function revisarLogros(d) {
  const evaluados = evaluarLogros(d)
  const { data: { user } } = await supabase.auth.getUser()
  const nuevos = evaluados.filter((l) => l.cumplido && !l.desbloqueado)
  if (nuevos.length) {
    await supabase.from('logros').insert(nuevos.map((l) => ({
      user_id: user.id, clave: l.clave, titulo: l.titulo, descripcion: l.descripcion,
    })))
  }
  const cobrados = new Set(d.bonos.map((b) => b.clave))
  const porPagar = evaluados.filter((l) => (l.desbloqueado || l.cumplido) && !cobrados.has(`logro-${l.clave}`))
  for (const l of porPagar) await cobrarBono(`logro-${l.clave}`, { monedas: RAREZAS[l.rareza].monedas })
  return { nuevos, cambios: nuevos.length > 0 || porPagar.length > 0 }
}
