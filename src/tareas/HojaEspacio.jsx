import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Hoja from '../ui/Hoja'

// Crear un espacio nuevo (espacio = null) o renombrar/eliminar uno existente
export default function HojaEspacio({ espacio, onGuardar, onEliminar, onCerrar }) {
  const [nombre, setNombre] = useState(espacio?.nombre || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) { setError('Ponle un nombre'); return }
    setGuardando(true)
    const ok = await onGuardar(nombre.trim(), espacio)
    setGuardando(false)
    if (ok) onCerrar()
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar "${espacio.nombre}" con todas sus columnas y tareas? No se puede deshacer.`)) return
    await onEliminar(espacio)
    onCerrar()
  }

  return (
    <Hoja titulo={espacio ? 'Editar espacio' : 'Nuevo espacio'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="form-hoja">
        <label className="campo">
          <span>Nombre</span>
          <input value={nombre} onChange={(e) => { setNombre(e.target.value); setError('') }}
            placeholder="Trabajo, Personal, Apps…" autoFocus />
        </label>
        {!espacio && <p className="texto-suave">Se crea con tres columnas: Por hacer, En proceso y Hecho.</p>}
        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>
          {espacio ? 'Guardar' : 'Crear espacio'}
        </button>
        {espacio && (
          <button type="button" className="boton-eliminar" onClick={eliminar}>
            <Trash2 size={15} /> Eliminar espacio
          </button>
        )}
      </form>
    </Hoja>
  )
}
