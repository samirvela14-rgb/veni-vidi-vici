export function hoyISO() {
  const d = new Date()
  const año = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

function formatearFecha(d) {
  const año = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

export function ultimosNDias(n) {
  const dias = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dias.push(formatearFecha(d))
  }
  return dias
}

export function diasDeEstaSemana() {
  const hoy = new Date()
  const diaSemana = hoy.getDay()
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - diaSemana + i)
    dias.push(formatearFecha(d))
  }
  return dias
}

export function nombreDiaCorto(fechaISO) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return dias[new Date(fechaISO + 'T00:00:00').getDay()]
}

// Semáforo brillante: rojo (día malo) → amarillo (día medio) → verde (día excelente).
// Se mezcla por tono (HSL) para que los intermedios sean naranja y verde lima vivos, no café.
const SEMAFORO = [
  { pct: 0, h: 2, s: 85, l: 57 },    // rojo
  { pct: 50, h: 52, s: 100, l: 52 }, // amarillo
  { pct: 100, h: 128, s: 76, l: 44 }, // verde
]

export function colorSemaforo(pct) {
  const p = Math.max(0, Math.min(100, pct))
  const i = p <= SEMAFORO[1].pct ? 0 : 1
  const a = SEMAFORO[i]
  const b = SEMAFORO[i + 1]
  const t = (p - a.pct) / (b.pct - a.pct)
  const mezcla = (x, y) => Math.round(x + (y - x) * t)
  return `hsl(${mezcla(a.h, b.h)}, ${mezcla(a.s, b.s)}%, ${mezcla(a.l, b.l)}%)`
}

export function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return formatearFecha(d)
}
// Convierte un timestamp de Supabase (UTC) a 'YYYY-MM-DD' en la hora local
export function fechaLocal(timestamp) {
  if (!timestamp) return null
  return formatearFecha(new Date(timestamp))
}
