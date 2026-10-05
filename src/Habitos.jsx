import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { hoyISO, ultimosNDias, diasDeEstaSemana, nombreDiaCorto, colorSemaforo } from './fechas'
import { otorgarXP, quitarXP } from './xp'
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
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)

  const dias84 = ultimosNDias(84)
  const diasSemana = diasDeEstaSemana()
  const hoy = hoyISO()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  async function cargar() {
    const [{ data: hs }, { data: todos }, { data: regs }] = await Promise.all([
      supabase.from('habitos').select('*').eq('activo', true).order('orden', { ascending: true }),
      supabase.from('habitos').select('id, creado_en, desactivado_en'),
      supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', dias84[0]),
    ])
    setHabitos(hs || [])
    setTodosHabitos(todos || [])
    setRegistros(regs || [])
    return { habitosFrescos: hs || [], registrosFrescos: regs || [] }
  }

  useEffect(() => { cargar() }, [])

  const estaMarcado = (habitoId, fecha) =>
    registros.some((r) => r.habito_id === habitoId && r.fecha === fecha)

  // Qué hábitos "contaban" en una fecha pasada (útil si cambiaste tu lista de hábitos)
  function habitosActivosEn(fecha) {
    return todosHabitos.filter((h) => {
      const creado = h.creado_en?.slice(0, 10)
      const desactivado = h.desactivado_en?.slice(0, 10)
      if (creado && creado > fecha) return false
      if (desactivado && desactivado <= fecha) return false
      return true
    })
  }

  async function toggle(habitoId, fecha) {
    const eraCompletoAntes = habitos.length > 0 && habitos.every((h) => estaMarcado(h.id, fecha))
    const yaEstaba = estaMarcado(habitoId, fecha)

    if (yaEstaba) {
      await supabase.from('habito_registros').delete()
        .eq('habito_id', habitoId).eq('fecha', fecha)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('habito_registros').insert({
        habito_id: habitoId, fecha, user_id: user.id,
      })
    }

    const { habitosFrescos, registrosFrescos } = await cargar()

    const marcadosAhora = new Set(
      registrosFrescos.filter((r) => r.fecha === fecha).map((r) => r.habito_id)
    )
    const esCompletoAhora = habitosFrescos.length > 0 && habitosFrescos.every((h) => marcadosAhora.has(h.id))

    const tareasXP = [yaEstaba ? quitarXP('habito') : otorgarXP('habito')]
    if (esCompletoAhora && !eraCompletoAntes) tareasXP.push(otorgarXP('dia_perfecto'))
    if (!esCompletoAhora && eraCompletoAntes) tareasXP.push(quitarXP('dia_perfecto'))
    await Promise.all(tareasXP)
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
    await supabase.from('habitos').update({
      activo: false, desactivado_en: new Date().toISOString(),
    }).eq('id', id)
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
    const activosEseDia = habitosActivosEn(fecha)
    return activosEseDia.length > 0 && activosEseDia.every((h) => estaMarcado(h.id, fecha))
  }

  let mejorRacha = 0, rachaTemp = 0
  dias84.forEach((f) => {
    if (diaCompleto(f)) { rachaTemp++; mejorRacha = Math.max(mejorRacha, rachaTemp) }
    else rachaTemp = 0
  })

  const diasCompletosUlt30 = ultimosNDias(30).filter(diaCompleto).length
  const tasaMensual = Math.round((diasCompletosUlt30 / 30) * 100)

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
            const color = habitosDeEseDia.length && marcados > 0 ? colorSemaforo(pct) : undefined
            return (
              <div
                key={f}
                className="heat-cell"
                style={color ? { background: color } : undefined}
                title={f}
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