export function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function ultimosNDias(n) {
  const dias = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dias.push(d.toISOString().slice(0, 10))
  }
  return dias
}

export function diasDeEstaSemana() {
  const hoy = new Date()
  const diaSemana = hoy.getDay() // 0=domingo ... 6=sábado
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - diaSemana + i)
    dias.push(d.toISOString().slice(0, 10))
  }
  return dias
}

export function nombreDiaCorto(fechaISO) {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return dias[new Date(fechaISO + 'T00:00:00').getDay()]
}


//COLORES
function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mezclar(colorA, colorB, t) {
  const [r1, g1, b1] = hexARgb(colorA)
  const [r2, g2, b2] = hexARgb(colorB)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function colorSemaforo(pct) {
  // pct: 0 a 100
  const ROJO = '#DE3535'
  const AMARILLO = '#EDFF2B'
  const VERDE = '#00B506'
  if (pct <= 53) {
    return mezclar(ROJO, AMARILLO, pct / 53)
  }
  return mezclar(AMARILLO, VERDE, (pct - 53) / (100 - 53))
}