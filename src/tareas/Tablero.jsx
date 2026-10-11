import { useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, closestCorners, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, Plus, Ellipsis, Trash2, CheckSquare, AlignLeft, Check } from 'lucide-react'
import { esColumnaHecha, estadoFecha, etiquetaFecha, formatoHora } from './base'

function TarjetaTarea({ tarjeta, checklist, hecha, onAbrir }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarjeta.id })
  const estado = estadoFecha(tarjeta.fecha_limite)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`tarea-card ${isDragging ? 'arrastrando' : ''} ${hecha ? 'hecha' : ''}`}
      onClick={() => onAbrir(tarjeta)}
    >
      <span className="tarea-card-titulo">
        {hecha && <Check size={14} />}
        {tarjeta.titulo}
      </span>
      {(tarjeta.fecha_limite || checklist?.total > 0 || tarjeta.detalle_extra) && (
        <div className="tarea-card-meta">
          {tarjeta.fecha_limite && (
            <span className={`chip-fecha ${hecha ? '' : estado}`}>{etiquetaFecha(tarjeta.fecha_limite)}{tarjeta.hora ? ` · ${formatoHora(tarjeta.hora)}` : ''}</span>
          )}
          {checklist?.total > 0 && (
            <span className={`tarea-card-check ${checklist.hechos === checklist.total ? 'completo' : ''}`}>
              <CheckSquare size={13} /> {checklist.hechos}/{checklist.total}
            </span>
          )}
          {tarjeta.detalle_extra && <AlignLeft size={13} className="texto-suave" />}
        </div>
      )}
    </div>
  )
}

function Columna({ columna, tarjetas, conteos, onAbrir, onAgregar, onRenombrar, onEliminar }) {
  const { setNodeRef } = useDroppable({ id: columna.id })
  const [agregando, setAgregando] = useState(false)
  const [texto, setTexto] = useState('')
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombre, setNombre] = useState(columna.nombre)
  const hecha = esColumnaHecha(columna.nombre)

  async function agregar(e) {
    e.preventDefault()
    if (!texto.trim()) { setAgregando(false); return }
    await onAgregar(columna.id, texto.trim())
    setTexto('')
  }

  async function guardarNombre() {
    setEditandoNombre(false)
    if (nombre.trim() && nombre.trim() !== columna.nombre) await onRenombrar(columna, nombre.trim())
    else setNombre(columna.nombre)
  }

  return (
    <div className="tab-columna">
      <div className="tab-columna-header">
        {editandoNombre ? (
          <input
            className="tab-columna-input"
            value={nombre}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setNombre(columna.nombre); setEditandoNombre(false) } }}
          />
        ) : (
          <button className="tab-columna-nombre" onClick={() => setEditandoNombre(true)} title="Renombrar">
            {columna.nombre}
          </button>
        )}
        <span className="tab-contador">{tarjetas.length}</span>
        <button className="tab-columna-borrar" onClick={() => onEliminar(columna)} aria-label={`Eliminar columna ${columna.nombre}`}>
          <Trash2 size={14} />
        </button>
      </div>

      <SortableContext items={tarjetas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="tab-tarjetas">
          {tarjetas.map((t) => (
            <TarjetaTarea key={t.id} tarjeta={t} checklist={conteos[t.id]} hecha={hecha} onAbrir={onAbrir} />
          ))}
          {tarjetas.length === 0 && !agregando && <div className="tab-vacia">Sin tareas</div>}
        </div>
      </SortableContext>

      {agregando ? (
        <form onSubmit={agregar} className="tab-agregar-form">
          <input
            autoFocus
            value={texto}
            placeholder="¿Qué hay que hacer?"
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => { if (!texto.trim()) setAgregando(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setTexto(''); setAgregando(false) } }}
          />
          <button type="submit" className="boton-vino-chico">Añadir</button>
        </form>
      ) : (
        <button className="tab-agregar" onClick={() => setAgregando(true)}>
          <Plus size={15} /> Añadir tarea
        </button>
      )}
    </div>
  )
}

// En el celular las pestañas también reciben tarjetas: así se mueven entre columnas
const PREFIJO_PASTILLA = 'pastilla-'

function Pastilla({ columna, activa, cantidad, arrastrando, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: PREFIJO_PASTILLA + columna.id })
  return (
    <button
      ref={setNodeRef}
      role="tab"
      aria-selected={activa}
      className={`pastilla ${activa ? 'activo' : ''} ${arrastrando ? 'destino' : ''} ${isOver ? 'encima' : ''}`}
      onClick={onClick}
    >
      {columna.nombre} <span>{cantidad}</span>
    </button>
  )
}

// Si el dedo está sobre una pestaña, gana la pestaña; si no, la columna más cercana
function detectarColision(args) {
  const pastilla = pointerWithin(args).find((c) => String(c.id).startsWith(PREFIJO_PASTILLA))
  return pastilla ? [pastilla] : closestCorners(args)
}

export default function Tablero({
  espacio, columnas, tarjetas, conteos, setTarjetas,
  onVolver, onEditarEspacio, onNuevaTarea, onAbrir, onAgregar, onPersistirOrden,
  onCrearColumna, onRenombrarColumna, onEliminarColumna, onColumnasBase,
}) {
  const [activa, setActiva] = useState(0)
  const [nuevaCol, setNuevaCol] = useState(null) // null = cerrado, '' = escribiendo
  const [arrastrada, setArrastrada] = useState(null)
  const carruselRef = useRef(null)
  const slidesRef = useRef([])
  const antesDeArrastrar = useRef(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // En el celular: mantener presionado para arrastrar, así no choca con deslizar
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const tarjetasDe = (colId) => tarjetas.filter((t) => t.columna_id === colId)

  // En el celular la altura sigue a la columna visible; en la compu es libre
  useLayoutEffect(() => {
    const el = carruselRef.current
    const actual = slidesRef.current[activa]
    if (!el || !actual) return
    const escritorio = window.matchMedia('(min-width: 768px)')
    const ajustar = () => { el.style.height = escritorio.matches ? '' : `${actual.offsetHeight}px` }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(actual)
    escritorio.addEventListener('change', ajustar)
    return () => { obs.disconnect(); escritorio.removeEventListener('change', ajustar) }
  }, [activa, columnas.length])

  function alDeslizar() {
    const el = carruselRef.current
    if (window.matchMedia('(min-width: 768px)').matches) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== activa) setActiva(i)
  }

  function irA(i) {
    const el = carruselRef.current
    const slide = slidesRef.current[i]
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: 'smooth' })
    setActiva(i)
  }

  // --- Arrastrar y soltar ---
  function columnaDe(id) {
    if (String(id).startsWith(PREFIJO_PASTILLA)) return columnas.find((c) => PREFIJO_PASTILLA + c.id === id)?.id
    return tarjetas.find((t) => t.id === id)?.columna_id ?? id
  }

  function alEmpezar({ active }) {
    antesDeArrastrar.current = tarjetas
    setArrastrada(tarjetas.find((t) => t.id === active.id) || null)
    navigator.vibrate?.(15)
  }

  function alCancelar() {
    setArrastrada(null)
    if (antesDeArrastrar.current) setTarjetas(antesDeArrastrar.current)
  }

  function alArrastrarSobre({ active, over }) {
    if (!over) return
    const origen = columnaDe(active.id)
    const destino = columnaDe(over.id)
    if (origen === destino) return
    setTarjetas((prev) => prev.map((t) => (t.id === active.id ? { ...t, columna_id: destino } : t)))
  }

  async function alSoltar({ active, over }) {
    setArrastrada(null)
    if (!over) { alCancelar(); return }
    const final = columnaDe(over.id)
    const enPastilla = String(over.id).startsWith(PREFIJO_PASTILLA)
    const ids = tarjetas.filter((t) => t.columna_id === final).map((t) => t.id)
    let ordenados = ids
    if (enPastilla) {
      // Soltada en una pestaña: va al final de esa columna
      ordenados = [...ids.filter((id) => id !== active.id), active.id]
    } else if (ids.includes(over.id) && ids.includes(active.id)) {
      ordenados = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))
    }
    await onPersistirOrden(active.id, final, ordenados)
    if (enPastilla) irA(columnas.findIndex((c) => c.id === final))
  }

  async function crearColumna(e) {
    e.preventDefault()
    if (!nuevaCol?.trim()) { setNuevaCol(null); return }
    await onCrearColumna(nuevaCol.trim())
    setNuevaCol(null)
  }

  const columnaActiva = columnas[activa]

  return (
    <div className="tablero">
      <header className="tablero-header">
        <button className="icono-btn" onClick={onVolver} aria-label="Volver a Tareas"><ChevronLeft size={18} /></button>
        <h2 className="tablero-titulo">{espacio.nombre}</h2>
        <button className="icono-btn" onClick={onEditarEspacio} aria-label="Editar espacio"><Ellipsis size={18} /></button>
        <button className="icono-btn vino" onClick={() => onNuevaTarea(columnaActiva?.id)} aria-label="Nueva tarea"><Plus size={18} /></button>
      </header>

      {columnas.length === 0 ? (
        <div className="tar-card tablero-vacio">
          <p>Este espacio todavía no tiene columnas.</p>
          <button className="boton-grande" onClick={onColumnasBase}>Empezar con Por hacer, En proceso y Hecho</button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={detectarColision}
          onDragStart={alEmpezar}
          onDragOver={alArrastrarSobre}
          onDragEnd={alSoltar}
          onDragCancel={alCancelar}
        >
          <div className="pastillas" role="tablist">
            {columnas.map((c, i) => (
              <Pastilla
                key={c.id}
                columna={c}
                activa={activa === i}
                cantidad={tarjetasDe(c.id).length}
                arrastrando={!!arrastrada}
                onClick={() => irA(i)}
              />
            ))}
            <button className="pastilla pastilla-mas" onClick={() => { setNuevaCol(''); irA(columnas.length) }} aria-label="Nueva columna">
              <Plus size={14} />
            </button>
          </div>
          {arrastrada && <p className="tab-pista">Suelta la tarea en una pestaña para moverla de columna</p>}

            <div className="tab-carrusel" ref={carruselRef} onScroll={alDeslizar}>
              {columnas.map((c, i) => (
                <div key={c.id} className="tab-slide" ref={(el) => { slidesRef.current[i] = el }}>
                  <Columna
                    columna={c}
                    tarjetas={tarjetasDe(c.id)}
                    conteos={conteos}
                    onAbrir={onAbrir}
                    onAgregar={onAgregar}
                    onRenombrar={onRenombrarColumna}
                    onEliminar={onEliminarColumna}
                  />
                </div>
              ))}
              <div className="tab-slide" ref={(el) => { slidesRef.current[columnas.length] = el }}>
                <div className="tab-columna tab-columna-nueva">
                  {nuevaCol !== null ? (
                    <form onSubmit={crearColumna} className="tab-agregar-form">
                      <input autoFocus value={nuevaCol} placeholder="Nombre de la columna"
                        onChange={(e) => setNuevaCol(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setNuevaCol(null) }} />
                      <button type="submit" className="boton-vino-chico">Crear</button>
                    </form>
                  ) : (
                    <button className="tab-agregar" onClick={() => setNuevaCol('')}><Plus size={15} /> Nueva columna</button>
                  )}
                </div>
              </div>
            </div>

          {/* La tarjeta flota sobre todo mientras se arrastra (no se corta en el carrusel) */}
          <DragOverlay dropAnimation={null}>
            {arrastrada && (
              <div className="tarea-card flotando">
                <span className="tarea-card-titulo">{arrastrada.titulo}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
