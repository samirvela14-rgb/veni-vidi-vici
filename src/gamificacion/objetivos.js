import { sumarDias } from '../fechas'
import { crearDiaPerfecto, rangoDias } from './dias'
import { cobrarBono } from './economia'

export const MONEDAS_POR_OBJETIVO = 10
const POR_SEMANA = 3

// Cada objetivo mide cuánto llevas esta semana (lunes a domingo)
const CATALOGO = [
  { clave: 'habitos_5', emoji: '🔥', texto: 'Ten 5 días perfectos de hábitos', meta: 5, medir: (s) => s.diasPerfectos },
  { clave: 'tareas_10', emoji: '✅', texto: 'Completa 10 tareas', meta: 10, medir: (s, d) => d.tareasSemana.length },
  { clave: 'gastos_7', emoji: '💸', texto: 'Registra tus movimientos los 7 días', meta: 7, medir: (s, d) => new Set(d.movimientosSemana).size },
  { clave: 'palabra_5', emoji: '📖', texto: 'Lee la Palabra 5 días', meta: 5, medir: (s, d) => d.palabra.filter((f) => f >= d.lunes).length },
  { clave: 'journal_4', emoji: '✍️', texto: 'Escribe en tu journal 4 veces', meta: 4, medir: (s, d) => d.journal.filter((f) => f >= d.lunes).length },
  { clave: 'etapas_3', emoji: '🧱', texto: 'Avanza 3 etapas de tus proyectos', meta: 3, medir: (s, d) => d.etapasSemana.length },
]

// Elige 3 distintos para la semana, siempre los mismos para un mismo lunes
function elegir(lunes) {
  const semilla = [...lunes].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7)
  const orden = CATALOGO.map((o, i) => ({ o, peso: (semilla * (i + 3) * 7919) % 1009 }))
    .sort((a, b) => a.peso - b.peso)
  return orden.slice(0, POR_SEMANA).map((x) => x.o)
}

export function objetivosDeLaSemana(d) {
  const diaPerfecto = crearDiaPerfecto(d.habitos, d.registros, d.especiales)
  const semana = rangoDias(d.lunes, d.hoy)
  const comun = { diasPerfectos: semana.filter(diaPerfecto).length }
  const cobrados = new Set(d.bonos.map((b) => b.clave))
  return elegir(d.lunes).map((o) => {
    const actual = Math.min(o.medir(comun, d), o.meta)
    const clave = `objetivo-${d.lunes}-${o.clave}`
    return { ...o, actual, cumplido: actual >= o.meta, cobrado: cobrados.has(clave), claveBono: clave }
  })
}

export function cobrarObjetivo(objetivo) {
  return cobrarBono(objetivo.claveBono, { monedas: MONEDAS_POR_OBJETIVO })
}

export function finDeSemana(lunes) {
  return sumarDias(lunes, 6)
}
