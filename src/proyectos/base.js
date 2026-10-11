import { hoyISO } from '../fechas'

export const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'progreso', label: 'En progreso' },
  { id: 'terminado', label: 'Terminado' },
]

// Solo colores de la paleta de la app
export const COLORES = {
  violeta: '#714cb6',
  vino: '#421d24',
  laguna: '#0c4243',
  lila: '#a993f0',
  tinta: '#292827',
}

export const TIPOS_META = [
  { id: 'dinero', label: 'Dinero' },
  { id: 'numero', label: 'Número' },
  { id: 'porcentaje', label: 'Porcentaje' },
]

export function valorMeta(tipo, n) {
  const v = Math.round(Number(n) || 0).toLocaleString('en-US')
  if (tipo === 'dinero') return `L. ${v}`
  if (tipo === 'porcentaje') return `${v}%`
  return v
}

export function diasHasta(fecha) {
  if (!fecha) return null
  const hoy = new Date(hoyISO() + 'T00:00:00')
  const meta = new Date(fecha + 'T00:00:00')
  return Math.round((meta - hoy) / (1000 * 60 * 60 * 24))
}

export function textoDias(fecha) {
  const d = diasHasta(fecha)
  if (d === null) return ''
  if (d < 0) return `Venció hace ${-d} día${d === -1 ? '' : 's'}`
  if (d === 0) return 'Es hoy'
  if (d === 1) return 'Falta 1 día'
  return `Faltan ${d} días`
}
