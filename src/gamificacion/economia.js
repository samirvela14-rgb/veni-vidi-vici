import { supabase } from '../supabaseClient'
import { ajustarXP, olvidarDobleXP } from '../xp'

export const XP_POR_MONEDA = 20

// Precios pensados para comprar de todos los niveles a la vez:
// pequeño cada ~3 días, mediano cada ~2 semanas, grande al mes, épico cada ~2.5 meses
export const NIVELES = [
  { id: 'pequeno', label: 'Pequeño', precio: 10, ritmo: 'cada ~3 días' },
  { id: 'mediano', label: 'Mediano', precio: 30, ritmo: 'cada ~2 semanas' },
  { id: 'grande', label: 'Grande', precio: 60, ritmo: 'cada mes' },
  { id: 'epico', label: 'Épico', precio: 150, ritmo: 'cada ~2.5 meses' },
]
export const precioDeNivel = (nivel) => NIVELES.find((n) => n.id === nivel)?.precio ?? 10

// Poderes dentro de la app
export const PODERES = [
  {
    clave: 'protector', emoji: '🛡️', nombre: 'Protector de racha', precio: 15,
    descripcion: 'Si un día no completas tus hábitos, se usa solo y tu racha no se rompe.', acumulable: true,
  },
  {
    clave: 'doble_xp', emoji: '⚡', nombre: 'Doble XP por 24 h', precio: 60,
    descripcion: 'Todo lo que hagas durante 24 horas da el doble de XP.',
  },
  {
    clave: 'revivir', emoji: '⏪', nombre: 'Revivir racha', precio: 60,
    descripcion: 'Rompiste tu racha ayer o anteayer y no tenías protector: la recuperas.',
  },
  {
    clave: 'titulo', emoji: '🖋️', nombre: 'Título personalizado', precio: 60,
    descripcion: 'Escribe tu propio título para que aparezca junto a tu nivel.', unico: true,
  },
  {
    clave: 'fondo', emoji: '🖼️', nombre: 'Fondo del Dashboard', precio: 30,
    descripcion: 'Cambia la foto del inicio por la que tú quieras.', unico: true,
  },
  {
    clave: 'descanso', emoji: '😴', nombre: 'Día de descanso', precio: 100,
    descripcion: 'Un día sin hábitos que no rompe tu racha ni baja tu tasa mensual.',
  },
]

// Premios reales con los que arranca la tienda (se pueden editar y borrar)
export const PREMIOS_BASE = [
  { nivel: 'pequeno', emoji: '☕', nombre: 'Café o bebida especial', monto_dinero: 60 },
  { nivel: 'pequeno', emoji: '🍰', nombre: 'Postre o snack fuera del meal prep', monto_dinero: 80 },
  { nivel: 'pequeno', emoji: '🎬', nombre: 'Un capítulo o película extra' },
  { nivel: 'pequeno', emoji: '🎮', nombre: '1 hora de juegos o redes sin culpa' },
  { nivel: 'pequeno', emoji: '😴', nombre: 'Dormir hasta tarde un sábado' },
  { nivel: 'mediano', emoji: '🍔', nombre: 'Cheat meal en mi lugar favorito', monto_dinero: 250 },
  { nivel: 'mediano', emoji: '🎟️', nombre: 'Ir al cine', monto_dinero: 200 },
  { nivel: 'mediano', emoji: '🏍️', nombre: 'Lavado o detallado de la moto', monto_dinero: 150 },
  { nivel: 'mediano', emoji: '📚', nombre: 'Un libro o curso pequeño', monto_dinero: 300 },
  { nivel: 'mediano', emoji: '🌅', nombre: 'Una mañana libre sin tareas' },
  { nivel: 'grande', emoji: '👕', nombre: 'Esa prenda de ropa que quiero', monto_dinero: 600 },
  { nivel: 'grande', emoji: '🎉', nombre: 'Salida especial', monto_dinero: 700 },
  { nivel: 'grande', emoji: '🏋️', nombre: 'Equipo o suplemento para el gym', monto_dinero: 600 },
  { nivel: 'grande', emoji: '🧤', nombre: 'Accesorio para la moto', monto_dinero: 500 },
  { nivel: 'grande', emoji: '🏖️', nombre: 'Un día completo libre' },
  { nivel: 'epico', emoji: '👟', nombre: 'Unos tenis buenos', monto_dinero: 2500 },
  { nivel: 'epico', emoji: '🎧', nombre: 'Un gadget (audífonos, reloj…)', monto_dinero: 2500 },
  { nivel: 'epico', emoji: '🏍️', nombre: 'Mejora para la moto', monto_dinero: 3000 },
  { nivel: 'epico', emoji: '✈️', nombre: 'Viaje de fin de semana', monto_dinero: 4000 },
  { nivel: 'epico', emoji: '🎓', nombre: 'Un curso o certificación', monto_dinero: 3000 },
]

export function calcularSaldo({ xp, bonos, compras }) {
  const ganadas = Math.floor(Math.max(0, Number(xp) || 0) / XP_POR_MONEDA)
  const extra = bonos.reduce((s, b) => s + (b.monedas || 0), 0)
  const gastadas = compras.reduce((s, c) => s + (c.costo || 0), 0)
  return { ganadas, extra, gastadas, saldo: ganadas + extra - gastadas }
}

export async function usuarioId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user.id
}

export async function registrarCompra({ tipo, clave, nombre, costo }) {
  const { data, error } = await supabase.from('compras')
    .insert({ tipo, clave, nombre, costo, user_id: await usuarioId() }).select().single()
  if (error) throw error
  if (clave === 'doble_xp') olvidarDobleXP()
  return data
}

// Cobra un bono una sola vez (la clave es única por usuario). Devuelve true si se cobró ahora.
export async function cobrarBono(clave, { xp = 0, monedas = 0 } = {}) {
  const { error } = await supabase.from('bonos').insert({ clave, xp, monedas, user_id: await usuarioId() })
  if (error) return false // ya estaba cobrado (o falta el SQL)
  if (xp) await ajustarXP(xp)
  return true
}

// La primera vez, la tienda arranca con los premios base (una sola vez, aunque el efecto corra doble)
let sembrandoPremios = null
export function asegurarPremios() {
  if (!sembrandoPremios) {
    sembrandoPremios = (async () => {
      const { count, error } = await supabase.from('recompensas').select('id', { count: 'exact', head: true })
      if (error || count) return
      const userId = await usuarioId()
      await supabase.from('recompensas').insert(PREMIOS_BASE.map((p) => ({
        ...p, costo_monedas: precioDeNivel(p.nivel), costo_xp: 0, veces_canjeada: 0, user_id: userId,
      })))
    })().catch(() => { sembrandoPremios = null })
  }
  return sembrandoPremios
}
