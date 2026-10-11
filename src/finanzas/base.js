// Orden en que se muestran los grupos de gasto
export const GRUPOS_GASTO = ['Vivir', 'Entretenimiento', 'Proyectos', 'Deuda', 'Ahorro']

// Presupuesto inicial: se precarga la primera vez que se abre Finanzas
export const CATEGORIAS_BASE = [
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Familia', icono: 'house', monto_planeado: 4500 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Combustible', icono: 'fuel', monto_planeado: 1200 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Mant. moto', icono: 'bike', monto_planeado: 400 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Taxi', icono: 'car-taxi-front', monto_planeado: 200 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Teléfono', icono: 'smartphone', monto_planeado: 180 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Comida', icono: 'salad', monto_planeado: 1900 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Corte', icono: 'scissors', monto_planeado: 600 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Higiene', icono: 'droplet', monto_planeado: 450 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Gym', icono: 'dumbbell', monto_planeado: 800 },
  { tipo: 'gasto', grupo: 'Vivir', nombre: 'Vitaminas', icono: 'pill', monto_planeado: 300 },
  { tipo: 'gasto', grupo: 'Entretenimiento', nombre: 'Salidas', icono: 'wine', monto_planeado: 650 },
  { tipo: 'gasto', grupo: 'Entretenimiento', nombre: 'Ropa', icono: 'shirt', monto_planeado: 500 },
  { tipo: 'gasto', grupo: 'Entretenimiento', nombre: 'Regalos', icono: 'gift', monto_planeado: 500 },
  { tipo: 'gasto', grupo: 'Entretenimiento', nombre: 'Suscripciones', icono: 'tv', monto_planeado: 425 },
  { tipo: 'gasto', grupo: 'Proyectos', nombre: 'Herramientas', icono: 'bot', monto_planeado: 550 },
  { tipo: 'gasto', grupo: 'Deuda', nombre: 'Deuda TV', icono: 'receipt', monto_planeado: 1600 },
  { tipo: 'gasto', grupo: 'Ahorro', nombre: 'Ahorro', icono: 'piggy-bank', monto_planeado: 3245 },
  { tipo: 'ingreso', grupo: 'Ingresos', nombre: 'Salario', icono: 'briefcase', monto_planeado: 18000 },
  { tipo: 'ingreso', grupo: 'Ingresos', nombre: 'Extra', icono: 'plus', monto_planeado: 0 },
  { tipo: 'ingreso', grupo: 'Ingresos', nombre: 'Otro', icono: 'refresh-cw', monto_planeado: 0 },
]

export const CONFIG_BASE = {
  ingreso_referencia: 18000,
  ahorro_minimo_pct: 20,
  entretenimiento_max_pct: 15,
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Los meses se manejan como texto 'YYYY-MM'
export function mesDe(fechaISO) {
  return fechaISO.slice(0, 7)
}

export function nombreMes(mes) {
  const [año, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${año}`
}

export function sumarMeses(mes, n) {
  const [año, m] = mes.split('-').map(Number)
  const d = new Date(año, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function rangoDelMes(mes) {
  const [año, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(año, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimoDia).padStart(2, '0')}` }
}

export function lempiras(n) {
  const valor = Math.round(Number(n) || 0)
  const signo = valor < 0 ? '-' : ''
  return `${signo}L. ${Math.abs(valor).toLocaleString('en-US')}`
}

export function numero(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US')
}

export function fechaCorta(fechaISO) {
  const [, m, d] = fechaISO.split('-').map(Number)
  return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()}`
}

export function pagosHechos(deuda) {
  if (!deuda.cuota_mensual) return 0
  return Math.round(Number(deuda.valor_actual) / Number(deuda.cuota_mensual))
}
