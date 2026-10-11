import { useEffect, useState } from 'react'
import { Calendar, Clock, Trash2, Plus, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { hoyISO, sumarDias } from '../fechas'
import Hoja from '../ui/Hoja'
import { abrirCalendario } from '../ui/abrirCalendario'
import { etiquetaFecha, estadoFecha, formatoHora } from './base'

export default function HojaTarea({ tarjeta, columnas, onGuardar, onEliminar, onChecklist, onCerrar }) {
  const [titulo, setTitulo] = useState(tarjeta.titulo)
  const [columnaId, setColumnaId] = useState(tarjeta.columna_id)
  const [fecha, setFecha] = useState(tarjeta.fecha_limite || '')
  const [hora, setHora] = useState(tarjeta.hora?.slice(0, 5) || '')
  const [detalle, setDetalle] = useState(tarjeta.detalle_extra || '')
  const [checklist, setChecklist] = useState([])
  const [nuevoItem, setNuevoItem] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    supabase.from('checklist_items').select('*').eq('tarjeta_id', tarjeta.id).order('orden')
      .then(({ data }) => { if (vigente) setChecklist(data || []) })
    return () => { vigente = false }
  }, [tarjeta.id])

  async function recargarChecklist() {
    const { data } = await supabase.from('checklist_items').select('*').eq('tarjeta_id', tarjeta.id).order('orden')
    setChecklist(data || [])
    onChecklist()
  }

  async function agregarItem(e) {
    e.preventDefault()
    if (!nuevoItem.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const maxOrden = checklist.length ? Math.max(...checklist.map((i) => i.orden)) : 0
    await supabase.from('checklist_items').insert({
      texto: nuevoItem.trim(), tarjeta_id: tarjeta.id, user_id: user.id, orden: maxOrden + 1,
    })
    setNuevoItem('')
    recargarChecklist()
  }

  async function alternarItem(item) {
    setChecklist(checklist.map((i) => (i.id === item.id ? { ...i, hecho: !i.hecho } : i)))
    await supabase.from('checklist_items').update({ hecho: !item.hecho }).eq('id', item.id)
    onChecklist()
  }

  async function eliminarItem(id) {
    setChecklist(checklist.filter((i) => i.id !== id))
    await supabase.from('checklist_items').delete().eq('id', id)
    onChecklist()
  }

  async function guardar(e) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Ponle un título'); return }
    setGuardando(true)
    const ok = await onGuardar(tarjeta, {
      titulo: titulo.trim(), columna_id: columnaId, fecha_limite: fecha || null, detalle_extra: detalle,
      // La hora solo se manda si cambió (así editar sigue funcionando aunque falte el SQL de la hora)
      ...((hora || null) !== (tarjeta.hora?.slice(0, 5) || null) && { hora: hora || null }),
    })
    setGuardando(false)
    if (ok) onCerrar()
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${tarjeta.titulo}"?`)) return
    await onEliminar(tarjeta)
    onCerrar()
  }

  const hechos = checklist.filter((i) => i.hecho).length
  const pct = checklist.length ? Math.round((hechos / checklist.length) * 100) : 0
  const hoy = hoyISO()

  return (
    <Hoja titulo="" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="form-hoja tarea-hoja">
        <textarea
          className="tarea-titulo-input"
          value={titulo}
          rows={1}
          onChange={(e) => { setTitulo(e.target.value); setError('') }}
          aria-label="Título"
          placeholder="¿Qué hay que hacer?"
        />

        <div>
          <span className="etiqueta-grupo">Columna</span>
          <div className="opciones">
            {columnas.map((c) => (
              <button type="button" key={c.id} className={`opcion ${columnaId === c.id ? 'activo' : ''}`}
                onClick={() => setColumnaId(c.id)}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="etiqueta-grupo">Fecha límite</span>
          <div className="opciones">
            <button type="button" className={`opcion ${fecha === hoy ? 'activo' : ''}`} onClick={() => setFecha(hoy)}>Hoy</button>
            <button type="button" className={`opcion ${fecha === sumarDias(hoy, 1) ? 'activo' : ''}`} onClick={() => setFecha(sumarDias(hoy, 1))}>Mañana</button>
            <label className={`opcion opcion-fecha ${fecha && fecha !== hoy && fecha !== sumarDias(hoy, 1) ? 'activo' : ''}`} onClick={abrirCalendario}>
              <Calendar size={14} />
              {fecha && fecha !== hoy && fecha !== sumarDias(hoy, 1) ? etiquetaFecha(fecha) : 'Elegir'}
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            {fecha && (
              <button type="button" className="opcion opcion-quitar" onClick={() => setFecha('')} aria-label="Quitar fecha">
                <X size={14} />
              </button>
            )}
            <label className={`opcion opcion-fecha ${hora ? 'activo' : ''}`} onClick={abrirCalendario}>
              <Clock size={14} />
              {hora ? formatoHora(hora) : 'Hora'}
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
            {hora && (
              <button type="button" className="opcion opcion-quitar" onClick={() => setHora('')} aria-label="Quitar hora">
                <X size={14} />
              </button>
            )}
          </div>
          {estadoFecha(fecha) === 'vencida' && <span className="texto-suave rojo">Esta tarea ya venció.</span>}
        </div>

        <label className="campo">
          <span>Detalles</span>
          <textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)}
            placeholder="Notas, contexto, enlaces…" />
        </label>

        <div className="tarea-checklist">
          <div className="tarea-checklist-header">
            <span className="etiqueta-grupo">Checklist</span>
            {checklist.length > 0 && <span className="texto-suave">{hechos}/{checklist.length}</span>}
          </div>
          {checklist.length > 0 && (
            <div className="barra-progreso barra-mini">
              <div className={`barra-relleno ${pct === 100 ? 'barra-completa' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <ul>
            {checklist.map((item) => (
              <li key={item.id}>
                <label>
                  <input type="checkbox" checked={item.hecho} onChange={() => alternarItem(item)} />
                  <span className={item.hecho ? 'checklist-hecho' : ''}>{item.texto}</span>
                </label>
                <button type="button" className="borrar" onClick={() => eliminarItem(item.id)} aria-label="Quitar">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="tarea-nuevo-item">
            <Plus size={16} />
            <input
              placeholder="Agregar paso"
              value={nuevoItem}
              onChange={(e) => setNuevoItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarItem(e) }}
            />
            {nuevoItem.trim() && <button type="button" className="boton-lila" onClick={agregarItem}>Agregar</button>}
          </div>
        </div>

        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button type="button" className="boton-eliminar" onClick={eliminar}>
          <Trash2 size={15} /> Eliminar tarea
        </button>
      </form>
    </Hoja>
  )
}
