import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TarjetaDetalle from './TarjetaDetalle'
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function TarjetaCard({ tarjeta, onAbrir }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tarjeta.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="trello-tarjeta"
      onClick={() => onAbrir(tarjeta)}
    >
      <span>{tarjeta.titulo}</span>
      {tarjeta.fecha_limite && <span className="trello-fecha">{tarjeta.fecha_limite}</span>}
    </div>
  )
}

function ColumnaTrello({ columna, tarjetas, onAgregar, onAbrir, onRenombrar, onEliminar }) {
  const { setNodeRef } = useDroppable({ id: columna.id })

  return (
    <div className="trello-columna">
      <div className="trello-columna-header">
        <span onClick={() => onRenombrar(columna)}>{columna.nombre}</span>
        <span className="trello-contador">{tarjetas.length}</span>
        <button className="trello-eliminar-col" onClick={() => onEliminar(columna)}>✕</button>
      </div>

      <SortableContext items={tarjetas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="trello-tarjetas">
          {tarjetas.map((t) => (
            <TarjetaCard key={t.id} tarjeta={t} onAbrir={onAbrir} />
          ))}
          {tarjetas.length === 0 && <div className="trello-columna-vacia" />}
        </div>
      </SortableContext>

      <button className="trello-add-btn" onClick={() => onAgregar(columna.id)}>
        + Añade una tarjeta
      </button>
    </div>
  )
}

export default function Tablero({ tablero, onVolver }) {
  const [columnas, setColumnas] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [nombreColNueva, setNombreColNueva] = useState('')
  const [agregandoCol, setAgregandoCol] = useState(false)
  const [tarjetaAbierta, setTarjetaAbierta] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function cargar() {
    const { data: cols } = await supabase
      .from('columnas').select('*').eq('tablero_id', tablero.id).order('orden')
    const idsColumnas = (cols || []).map((c) => c.id)
    const { data: todasTarjetas } = idsColumnas.length
      ? await supabase.from('tarjetas').select('*').in('columna_id', idsColumnas).order('orden')
      : { data: [] }
    setColumnas(cols || [])
    setTarjetas(todasTarjetas || [])
  }

  useEffect(() => { cargar() }, [tablero.id])

  async function crearColumna(e) {
    e.preventDefault()
    if (!nombreColNueva.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const maxOrden = columnas.length ? Math.max(...columnas.map((c) => c.orden)) : 0
    await supabase.from('columnas').insert({
      nombre: nombreColNueva, tablero_id: tablero.id, user_id: user.id, orden: maxOrden + 1,
    })
    setNombreColNueva('')
    setAgregandoCol(false)
    cargar()
  }

  async function renombrarColumna(columna) {
    const nuevo = prompt('Nuevo nombre:', columna.nombre)
    if (!nuevo || !nuevo.trim()) return
    await supabase.from('columnas').update({ nombre: nuevo }).eq('id', columna.id)
    cargar()
  }

  async function eliminarColumna(columna) {
    if (!confirm(`¿Eliminar la columna "${columna.nombre}" y sus tarjetas?`)) return
    await supabase.from('columnas').delete().eq('id', columna.id)
    cargar()
  }

  async function agregarTarjeta(columnaId) {
    const { data: { user } } = await supabase.auth.getUser()
    const tarjetasDeEsaCol = tarjetas.filter((t) => t.columna_id === columnaId)
    const maxOrden = tarjetasDeEsaCol.length ? Math.max(...tarjetasDeEsaCol.map((t) => t.orden)) : 0
    const { data: nueva } = await supabase.from('tarjetas').insert({
      titulo: 'Nueva tarjeta', columna_id: columnaId, user_id: user.id, orden: maxOrden + 1,
    }).select().single()
    await cargar()
    setTarjetaAbierta(nueva)
  }

  // --- Drag & drop entre columnas ---
  function idDeColumna(id) {
    // el "id" puede ser una tarjeta (buscar su columna) o ya ser una columna
    const t = tarjetas.find((t) => t.id === id)
    if (t) return t.columna_id
    return id
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over) return

    const columnaOrigen = idDeColumna(active.id)
    const columnaDestino = idDeColumna(over.id)
    if (columnaOrigen === columnaDestino) return

    // Mueve la tarjeta visualmente a la nueva columna al instante (sin esperar guardar)
    setTarjetas((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, columna_id: columnaDestino } : t))
    )
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return

    const columnaFinal = idDeColumna(over.id)

    // Reordena dentro de la columna final
    const idsColumnaFinal = tarjetas
      .filter((t) => t.columna_id === columnaFinal)
      .map((t) => t.id)

    let ordenados = idsColumnaFinal
    if (idsColumnaFinal.includes(over.id)) {
      const oldIndex = idsColumnaFinal.indexOf(active.id)
      const newIndex = idsColumnaFinal.indexOf(over.id)
      ordenados = arrayMove(idsColumnaFinal, oldIndex, newIndex)
    }

    // Guarda en Supabase: columna final + orden de cada tarjeta en esa columna
    await supabase.from('tarjetas').update({ columna_id: columnaFinal }).eq('id', active.id)
    await Promise.all(
      ordenados.map((id, idx) => supabase.from('tarjetas').update({ orden: idx }).eq('id', id))
    )
    cargar()
  }

  return (
    <div className="trello-pantalla">
      <div className="trello-header">
        <button className="btn-volver" onClick={onVolver}>← Espacios</button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="trello-columnas-fila">
          {columnas.map((col) => (
            <ColumnaTrello
              key={col.id}
              columna={col}
              tarjetas={tarjetas.filter((t) => t.columna_id === col.id)}
              onAgregar={agregarTarjeta}
              onAbrir={setTarjetaAbierta}
              onRenombrar={renombrarColumna}
              onEliminar={eliminarColumna}
            />
          ))}

          <div className="trello-columna trello-nueva-columna">
            {agregandoCol ? (
              <form onSubmit={crearColumna} className="trello-add-form">
                <input
                  autoFocus
                  value={nombreColNueva}
                  onChange={(e) => setNombreColNueva(e.target.value)}
                  placeholder="Nombre de la columna..."
                />
                <div className="fila">
                  <button type="submit">Añadir</button>
                  <button type="button" onClick={() => setAgregandoCol(false)}>✕</button>
                </div>
              </form>
            ) : (
              <button className="trello-add-btn" onClick={() => setAgregandoCol(true)}>
                + Añadir columna
              </button>
            )}
          </div>
        </div>
      </DndContext>

      {tarjetaAbierta && (
        <TarjetaDetalle
          tarjeta={tarjetaAbierta}
          onCerrar={() => setTarjetaAbierta(null)}
          onCambio={cargar}
        />
      )}
    </div>
  )
}