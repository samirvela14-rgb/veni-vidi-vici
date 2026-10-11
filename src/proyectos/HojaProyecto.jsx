import { useState } from 'react'
import { Calendar, Plus, Trash2, X, Check } from 'lucide-react'
import Hoja from '../ui/Hoja'
import { abrirCalendario } from '../ui/abrirCalendario'
import { ESTADOS, COLORES, textoDias } from './base'

export default function HojaProyecto({
  proyecto, etapas = [], onGuardar, onEliminar, onAlternarEtapa, onAgregarEtapa, onBorrarEtapa, onCerrar,
}) {
  const nuevo = !proyecto
  const [nombre, setNombre] = useState(proyecto?.nombre || '')
  const [etiqueta, setEtiqueta] = useState(proyecto?.etiqueta || '')
  const [color, setColor] = useState(proyecto?.color || 'violeta')
  // El estado cambia solo al marcar etapas; solo se guarda si lo eliges a mano
  const [estadoElegido, setEstadoElegido] = useState(null)
  const estado = estadoElegido || proyecto?.estado || 'pendiente'
  const [fecha, setFecha] = useState(proyecto?.fecha_objetivo || '')
  const [descripcion, setDescripcion] = useState(proyecto?.descripcion || '')
  const [borradorEtapas, setBorradorEtapas] = useState([]) // solo al crear
  const [nuevaEtapa, setNuevaEtapa] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const lista = nuevo ? borradorEtapas.map((n, i) => ({ id: `b${i}`, nombre: n, hecha: false })) : etapas
  const hechas = lista.filter((e) => e.hecha).length
  const pct = lista.length ? Math.round((hechas / lista.length) * 100) : 0

  async function agregarEtapa(e) {
    e?.preventDefault()
    const texto = nuevaEtapa.trim()
    if (!texto) return
    if (nuevo) setBorradorEtapas([...borradorEtapas, texto])
    else await onAgregarEtapa(proyecto, texto)
    setNuevaEtapa('')
  }

  function quitarEtapa(etapa, i) {
    if (nuevo) setBorradorEtapas(borradorEtapas.filter((_, j) => j !== i))
    else onBorrarEtapa(etapa)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) { setError('Ponle un nombre al proyecto'); return }
    setGuardando(true)
    const ok = await onGuardar({
      nombre: nombre.trim(), etiqueta: etiqueta.trim(), color,
      ...(estadoElegido && { estado: estadoElegido }),
      fecha_objetivo: fecha || null, descripcion: descripcion.trim(),
    }, proyecto, borradorEtapas)
    setGuardando(false)
    if (ok) onCerrar()
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${proyecto.nombre}" y sus etapas?`)) return
    await onEliminar(proyecto)
    onCerrar()
  }

  return (
    <Hoja titulo={nuevo ? 'Nuevo proyecto' : ''} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="form-hoja">
        <textarea
          className="tarea-titulo-input"
          rows={1}
          placeholder="Nombre del proyecto"
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); setError('') }}
          autoFocus={nuevo}
          aria-label="Nombre"
        />

        {!nuevo && (
          <div className="segmentado">
            {ESTADOS.map((s) => (
              <button type="button" key={s.id} className={estado === s.id ? 'activo' : ''} onClick={() => setEstadoElegido(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="pro-etapas">
          <div className="pro-etapas-header">
            <span className="etiqueta-grupo">Etapas</span>
            {lista.length > 0 && <span className="texto-suave">{hechas}/{lista.length} · {pct}%</span>}
          </div>
          {lista.length > 0 && (
            <div className="barra-progreso barra-mini">
              <div className={`barra-relleno ${pct === 100 ? 'barra-completa' : ''}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <ol>
            {lista.map((et, i) => (
              <li key={et.id} className={et.hecha ? 'hecha' : ''}>
                {nuevo ? (
                  <span className="pro-etapa-num">{i + 1}</span>
                ) : (
                  <button type="button" className="pro-etapa-check" onClick={() => onAlternarEtapa(et)}
                    aria-label={et.hecha ? `Desmarcar ${et.nombre}` : `Marcar ${et.nombre}`}>
                    {et.hecha ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </button>
                )}
                <span className="pro-etapa-nombre">{et.nombre}</span>
                <button type="button" className="borrar" onClick={() => quitarEtapa(et, i)} aria-label="Quitar etapa">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
          <div className="tarea-nuevo-item">
            <Plus size={16} />
            <input
              placeholder={lista.length ? 'Agregar otra etapa' : 'Primera etapa: idea, diseño, lanzamiento…'}
              value={nuevaEtapa}
              onChange={(e) => setNuevaEtapa(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') agregarEtapa(e) }}
            />
            {nuevaEtapa.trim() && <button type="button" className="boton-lila" onClick={agregarEtapa}>Agregar</button>}
          </div>
        </div>

        <div className="fila-campos">
          <label className="campo">
            <span>Etiqueta</span>
            <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="App, Tesis…" maxLength={24} />
          </label>
          <div className="campo">
            <span>Fecha objetivo</span>
            <div className="opciones">
              <label className={`opcion opcion-fecha ${fecha ? 'activo' : ''}`} onClick={abrirCalendario}>
                <Calendar size={14} />
                {fecha ? textoDias(fecha) : 'Elegir'}
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              {fecha && (
                <button type="button" className="opcion opcion-quitar" onClick={() => setFecha('')} aria-label="Quitar fecha">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="etiqueta-grupo">Color</span>
          <div className="pro-colores">
            {Object.entries(COLORES).map(([id, hex]) => (
              <button type="button" key={id} className={color === id ? 'activo' : ''} style={{ '--c': hex }}
                onClick={() => setColor(id)} aria-label={`Color ${id}`} />
            ))}
          </div>
        </div>

        <label className="campo">
          <span>Descripción</span>
          <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="¿De qué se trata? ¿Para qué lo haces?" />
        </label>

        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>
          {guardando ? 'Guardando...' : nuevo ? 'Crear proyecto' : 'Guardar'}
        </button>
        {!nuevo && (
          <button type="button" className="boton-eliminar" onClick={eliminar}>
            <Trash2 size={15} /> Eliminar proyecto
          </button>
        )}
      </form>
    </Hoja>
  )
}
