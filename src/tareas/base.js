import { supabase } from '../supabaseClient'
import { hoyISO, sumarDias } from '../fechas'

// Columnas con las que nace cada tablero nuevo
export const COLUMNAS_BASE = ['Por hacer', 'En proceso', 'Hecho']

// Una tarea cuenta como terminada si está en una columna con nombre de "hecho"
export function esColumnaHecha(nombre = '') {
  return /hecho|hecha|listo|lista|terminad|complet|done/i.test(nombre)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// vencida | hoy | manana | semana | futura | null
export function estadoFecha(fecha) {
  if (!fecha) return null
  const hoy = hoyISO()
  if (fecha < hoy) return 'vencida'
  if (fecha === hoy) return 'hoy'
  if (fecha === sumarDias(hoy, 1)) return 'manana'
  if (fecha <= sumarDias(hoy, 6)) return 'semana'
  return 'futura'
}

export function etiquetaFecha(fecha) {
  if (!fecha) return ''
  const d = new Date(fecha + 'T00:00:00')
  const corta = `${d.getDate()} ${MESES[d.getMonth()]}`
  switch (estadoFecha(fecha)) {
    case 'vencida': return `Vencida · ${corta}`
    case 'hoy': return 'Hoy'
    case 'manana': return 'Mañana'
    case 'semana': return `${DIAS[d.getDay()]} ${d.getDate()}`
    default: return corta
  }
}

// Devuelve el tablero del espacio; si no existe lo crea con las columnas base
export async function tableroDeEspacio(espacio) {
  const { data: existentes } = await supabase
    .from('tableros').select('*').eq('espacio_id', espacio.id).limit(1)
  if (existentes?.[0]) return existentes[0]

  const { data: { user } } = await supabase.auth.getUser()
  const { data: nuevo, error } = await supabase
    .from('tableros')
    .insert({ nombre: espacio.nombre, espacio_id: espacio.id, user_id: user.id })
    .select().single()
  if (error) throw error
  await crearColumnasBase(nuevo.id, user.id)
  return nuevo
}

export async function crearColumnasBase(tableroId, userId) {
  const { error } = await supabase.from('columnas').insert(
    COLUMNAS_BASE.map((nombre, i) => ({ nombre, tablero_id: tableroId, user_id: userId, orden: i + 1 }))
  )
  if (error) throw error
}

// '15:00:00' → '3:00 pm'
export function formatoHora(hora) {
  if (!hora) return ''
  const [h, m] = hora.split(':').map(Number)
  const sufijo = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`
}

// Ordena por fecha límite y, dentro del mismo día, por hora (sin hora va al final del día)
export function porFechaYHora(a, b) {
  const fa = a.fecha_limite || '9999-12-31'
  const fb = b.fecha_limite || '9999-12-31'
  if (fa !== fb) return fa.localeCompare(fb)
  return (a.hora || '99').localeCompare(b.hora || '99')
}
