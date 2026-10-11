import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { hoyISO, ultimosNDias, diasDeEstaSemana, nombreDiaCorto, colorSemaforo, fechaLocal } from './fechas'
import { otorgarXP, quitarXP } from './xp'
import { aplicarProtectores } from './gamificacion/dias'
import { ejecutar } from './offline/cola'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function FilaHabito({ h, diasSemana, hoy, estaMarcado, toggle, renombrarHabito, eliminarHabito, modoEdicion }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: h.id, disabled: !modoEdicion })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="tabla-fila">
      <div className="nombre-habito-fila">
        {modoEdicion && (
          <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
        )}
        <span
          className="nombre-habito"
          onClick={() => modoEdicion && renombrarHabito(h.id, h.nombre)}
        >
          {h.nombre}
        </span>
        {modoEdicion && (
          <button className="btn-eliminar-habito" onClick={() => eliminarHabito(h.id)}>✕</button>
        )}
      </div>
      {diasSemana.map((f) => (
        <button
          key={f}
          className={`check-dia ${estaMarcado(h.id, f) ? 'marcado' : ''}`}
          onClick={() => toggle(h.id, f)}
          disabled={f > hoy}
        >
          {estaMarcado(h.id, f) ? '✓' : ''}
        </button>
      ))}
    </div>
  )
}

export default function Habitos() {
  const [habitos, setHabitos] = useState([])
  const [todosHabitos, setTodosHabitos] = useState([])
  const [registros, setRegistros] = useState([])
  const [especiales, setEspeciales] = useState(new Map()) // fecha -> 'protector' | 'descanso'
  const enProceso = useRef(new Set())
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)

  const dias84 = ultimosNDias(84)
  const diasSemana = diasDeEstaSemana()
  const hoy = hoyISO()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function cargar() {
    const [{ data: hs }, historial, { data: regs }, { data: esp }] = await Promise.all([
      supabase.from('habitos').select('*').eq('activo', true).order('orden', { ascending: true }),
      supabase.from('habitos').select('id, creado_en, desactivado_en, activo'),
      supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', dias84[0]),
      supabase.from('dias_especiales').select('fecha, tipo').gte('fecha', dias84[0]),
    ])
    setEspeciales(new Map((esp || []).map((e) => [e.fecha, e.tipo])))
    let todos = historial.data
    if (historial.error) {
      // Sin la columna desactivado_en el heatmap quedaba vacío: se usa solo lo que exista
      const respaldo = await supabase.from('habitos').select('id, creado_en, activo')
      todos = (respaldo.data || []).filter((h) => h.activo !== false)
    }
    setHabitos(hs || [])
    setTodosHabitos(todos || [])
    setRegistros(regs || [])
    return { habitosFrescos: hs || [], registrosFrescos: regs || [] }
  }

  // Si ayer fallaste y tienes un protector guardado, se usa solo antes de cargar
  useEffect(() => { aplicarProtectores().finally(cargar) }, [])

  const estaMarcado = (habitoId, fecha) =>
    registros.some((r) => r.habito_id === habitoId && r.fecha === fecha)

  // Qué hábitos "contaban" en una fecha pasada (útil si cambiaste tu lista de hábitos)
  function habitosActivosEn(fecha) {
    return todosHabitos.filter((h) => {
      const creado = fechaLocal(h.creado_en)
      const desactivado = fechaLocal(h.desactivado_en)
      if (creado && creado > fecha) return false
      if (desactivado && desactivado <= fecha) return false
      return true
    })
  }

  async function toggle(habitoId, fecha) {
    // Evita el doble toque: mientras se guarda, ese círculo no responde otra vez
    const clave = `${habitoId}|${fecha}`
    if (enProceso.current.has(clave)) return
    enProceso.current.add(clave)

    const yaEstaba = estaMarcado(habitoId, fecha)
    const quitar = (lista) => lista.filter((x) => !(x.habito_id === habitoId && x.fecha === fecha))
    const poner = (lista) => [...quitar(lista), { habito_id: habitoId, fecha }]

    // 1) Se marca al instante en la pantalla (sin esperar al servidor)
    const registrosNuevos = yaEstaba ? quitar(registros) : poner(registros)
    setRegistros((prev) => (yaEstaba ? quitar(prev) : poner(prev)))
    const completoDia = (lista) => habitos.length > 0
      && habitos.every((h) => lista.some((x) => x.habito_id === h.id && x.fecha === fecha))
    const eraCompletoAntes = completoDia(registros)
    const esCompletoAhora = completoDia(registrosNuevos)

    // 2) Se guarda por detrás. Funciona sin internet (se envía después) y no se duplica.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await ejecutar(yaEstaba
        ? { tabla: 'habito_registros', accion: 'delete', filtro: { habito_id: habitoId, fecha }, xp: { quitar: ['habito'] } }
        : {
            tabla: 'habito_registros', accion: 'insert',
            datos: { id: crypto.randomUUID(), habito_id: habitoId, fecha, user_id: session.user.id },
            xp: { otorgar: ['habito'] },
          })
      if (!r.ok) {
        // El servidor lo rechazó: se deshace en la pantalla y se avisa
        setRegistros((prev) => (yaEstaba ? poner(prev) : quitar(prev)))
        alert(r.error)
        return
      }
      // Bono de día perfecto (con conexión; sin internet se cuenta al volver a abrir)
      if (!r.pendiente && esCompletoAhora && !eraCompletoAntes) await otorgarXP('dia_perfecto')
      if (!r.pendiente && !esCompletoAhora && eraCompletoAntes) await quitarXP('dia_perfecto')
    } finally {
      enProceso.current.delete(clave)
    }
  }

  async function agregarHabito(e) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const maxOrden = habitos.length ? Math.max(...habitos.map((h) => h.orden)) : 0
    const { error } = await supabase.from('habitos').insert({
      nombre: nombreNuevo, user_id: user.id, orden: maxOrden + 1,
    })
    if (error) { alert(error.message); return }
    setNombreNuevo('')
    cargar()
  }

  async function eliminarHabito(id) {
    if (!confirm('¿Eliminar este hábito? Se conserva tu historial pasado.')) return
    const { error } = await supabase.from('habitos').update({
      activo: false, desactivado_en: new Date().toISOString(),
    }).eq('id', id)
    if (error) { alert(error.message); return }
    cargar()
  }

  async function renombrarHabito(id, nombreActual) {
    const nuevo = prompt('Nuevo nombre:', nombreActual)
    if (!nuevo || !nuevo.trim()) return
    await supabase.from('habitos').update({ nombre: nuevo }).eq('id', id)
    cargar()
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = habitos.findIndex((h) => h.id === active.id)
    const newIndex = habitos.findIndex((h) => h.id === over.id)
    const nuevoOrden = arrayMove(habitos, oldIndex, newIndex)
    setHabitos(nuevoOrden)

    await Promise.all(
      nuevoOrden.map((h, idx) =>
        supabase.from('habitos').update({ orden: idx }).eq('id', h.id)
      )
    )
  }

  const registrosHoy = registros.filter((r) => r.fecha === hoy).length
  const progresoHoyPct = habitos.length ? Math.round((registrosHoy / habitos.length) * 100) : 0

  function diaCompleto(fecha) {
    // Días protegidos o de descanso (comprados en la Tienda) no rompen la racha
    if (especiales.has(fecha)) return true
    const activosEseDia = habitosActivosEn(fecha)
    return activosEseDia.length > 0 && activosEseDia.every((h) => estaMarcado(h.id, fecha))
  }

  let mejorRacha = 0, rachaTemp = 0
  dias84.forEach((f) => {
    if (diaCompleto(f)) { rachaTemp++; mejorRacha = Math.max(mejorRacha, rachaTemp) }
    else rachaTemp = 0
  })

  // Los días de descanso no cuentan en la tasa (ni a favor ni en contra)
  const ult30 = ultimosNDias(30).filter((f) => especiales.get(f) !== 'descanso')
  const diasCompletosUlt30 = ult30.filter(diaCompleto).length
  const tasaMensual = ult30.length ? Math.round((diasCompletosUlt30 / ult30.length) * 100) : 0

  return (
    <div className="seccion">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-valor">{progresoHoyPct}%</span>
          <span className="stat-label">{registrosHoy} de {habitos.length} listos</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor">🔥 {mejorRacha}</span>
          <span className="stat-label">Mejor racha</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor verde">{tasaMensual}%</span>
          <span className="stat-label">Tasa mensual</span>
        </div>
      </div>

      <div className="tabla-semanal">
        <div className="tabla-header">
          <button className="btn-editar-toggle" onClick={() => setModoEdicion(!modoEdicion)}>
            {modoEdicion ? 'Listo' : 'Editar'}
          </button>
          {diasSemana.map((f) => (
            <span key={f} className={f === hoy ? 'dia-hoy' : ''}>
              {nombreDiaCorto(f)}
            </span>
          ))}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={habitos.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            {habitos.map((h) => (
              <FilaHabito
                key={h.id}
                h={h}
                diasSemana={diasSemana}
                hoy={hoy}
                estaMarcado={estaMarcado}
                toggle={toggle}
                renombrarHabito={renombrarHabito}
                eliminarHabito={eliminarHabito}
                modoEdicion={modoEdicion}
              />
            ))}
          </SortableContext>
        </DndContext>

        {habitos.length === 0 && <p className="vacio">Aún no tienes hábitos.</p>}
      </div>

      <div className="heatmap-card">
        <div className="heatmap-header"><span>Últimos 84 días</span></div>
        <div className="heatmap-grid">
          {dias84.map((f) => {
            const habitosDeEseDia = habitosActivosEn(f)
            const marcados = habitosDeEseDia.filter((h) => estaMarcado(h.id, f)).length
            const pct = habitosDeEseDia.length ? (marcados / habitosDeEseDia.length) * 100 : 0
            const especial = especiales.get(f)
            // Día pasado sin nada = rojo; hoy se queda neutro mientras sigue en curso
            const pintar = !especial && habitosDeEseDia.length > 0 && (marcados > 0 || f < hoy)
            const color = pintar ? colorSemaforo(pct) : undefined
            return (
              <div
                key={f}
                className={`heat-cell ${especial ? `heat-${especial}` : ''}`}
                style={color ? { background: color } : undefined}
                title={especial === 'protector' ? `${f} · protegido 🛡️` : especial === 'descanso' ? `${f} · descanso 😴` : f}
              />
            )
          })}
        </div>
      </div>

      <form onSubmit={agregarHabito} className="form-rapido">
        <input
          placeholder="Nuevo hábito..."
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
    </div>
  )
}