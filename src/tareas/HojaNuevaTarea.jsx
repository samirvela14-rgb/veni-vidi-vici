import { useState } from 'react'
import { Calendar, Clock, X } from 'lucide-react'
import { hoyISO, sumarDias } from '../fechas'
import Hoja from '../ui/Hoja'
import { abrirCalendario } from '../ui/abrirCalendario'
import { etiquetaFecha, formatoHora } from './base'

export default function HojaNuevaTarea({ espacios, columnasDe, espacioInicial, columnaInicial, onCrear, onCerrar }) {
  const [titulo, setTitulo] = useState('')
  const [espacioId, setEspacioId] = useState(espacioInicial || espacios[0]?.id || null)
  const [columnaId, setColumnaId] = useState(columnaInicial || null)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const columnas = espacioId ? columnasDe(espacioId) : []
  // Si no se eligió columna, va a la primera del tablero
  const columnaElegida = columnas.some((c) => c.id === columnaId) ? columnaId : columnas[0]?.id || null
  const hoy = hoyISO()
  const manana = sumarDias(hoy, 1)

  async function crear(e) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Escribe qué hay que hacer'); return }
    if (!espacioId) { setError('Primero crea un espacio de trabajo'); return }
    setGuardando(true)
    const ok = await onCrear({
      titulo: titulo.trim(), espacio: espacios.find((s) => s.id === espacioId), columnaId: columnaElegida, fecha: fecha || null, hora: hora || null,
    })
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Hoja titulo="Nueva tarea" onCerrar={onCerrar}>
      <form onSubmit={crear} className="form-hoja">
        <textarea
          className="tarea-titulo-input"
          rows={1}
          placeholder="¿Qué hay que hacer?"
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) crear(e) }}
          autoFocus
          aria-label="Título"
        />

        {espacios.length > 1 && (
          <div>
            <span className="etiqueta-grupo">Espacio</span>
            <div className="opciones">
              {espacios.map((s) => (
                <button type="button" key={s.id} className={`opcion ${espacioId === s.id ? 'activo' : ''}`}
                  onClick={() => { setEspacioId(s.id); setColumnaId(null) }}>
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {columnas.length > 1 && (
          <div>
            <span className="etiqueta-grupo">Columna</span>
            <div className="opciones">
              {columnas.map((c) => (
                <button type="button" key={c.id} className={`opcion ${columnaElegida === c.id ? 'activo' : ''}`}
                  onClick={() => setColumnaId(c.id)}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="etiqueta-grupo">Fecha límite</span>
          <div className="opciones">
            <button type="button" className={`opcion ${fecha === hoy ? 'activo' : ''}`} onClick={() => setFecha(fecha === hoy ? '' : hoy)}>Hoy</button>
            <button type="button" className={`opcion ${fecha === manana ? 'activo' : ''}`} onClick={() => setFecha(fecha === manana ? '' : manana)}>Mañana</button>
            <label className={`opcion opcion-fecha ${fecha && fecha !== hoy && fecha !== manana ? 'activo' : ''}`} onClick={abrirCalendario}>
              <Calendar size={14} />
              {fecha && fecha !== hoy && fecha !== manana ? etiquetaFecha(fecha) : 'Elegir'}
              <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />
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
        </div>

        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>
          {guardando ? 'Creando...' : 'Crear tarea'}
        </button>
      </form>
    </Hoja>
  )
}
