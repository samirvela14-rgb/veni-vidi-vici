import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function EspaciosTrabajo({ onEntrar }) {
  const [espacios, setEspacios] = useState([])
  const [nombreNuevo, setNombreNuevo] = useState('')

  async function cargar() {
    const { data } = await supabase
      .from('espacios_trabajo')
      .select('*')
      .order('creado_en', { ascending: false })
    setEspacios(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function crear(e) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('espacios_trabajo').insert({
      nombre: nombreNuevo, user_id: user.id,
    })
    if (error) { alert(error.message); return }
    setNombreNuevo('')
    cargar()
  }

  async function renombrar(espacio) {
    const nuevo = prompt('Nuevo nombre:', espacio.nombre)
    if (!nuevo || !nuevo.trim()) return
    await supabase.from('espacios_trabajo').update({ nombre: nuevo }).eq('id', espacio.id)
    cargar()
  }

  async function eliminar(espacio) {
    if (!confirm(`¿Eliminar "${espacio.nombre}" y todos sus tableros/tarjetas? Esta acción no se puede deshacer.`)) return
    await supabase.from('espacios_trabajo').delete().eq('id', espacio.id)
    cargar()
  }

  return (
    <div className="seccion">
      <h2 className="titulo-seccion">Espacios de trabajo</h2>

      <div className="lista-espacios">
        {espacios.map((e) => (
          <div key={e.id} className="tarjeta-espacio">
            <button className="tarjeta-espacio-nombre" onClick={() => onEntrar(e)}>
              📁 {e.nombre}
            </button>
            <div className="tarjeta-espacio-acciones">
              <button onClick={() => renombrar(e)}>✎</button>
              <button onClick={() => eliminar(e)}>✕</button>
            </div>
          </div>
        ))}
        {espacios.length === 0 && <p className="vacio">Aún no tienes espacios de trabajo.</p>}
      </div>

      <form onSubmit={crear} className="form-rapido">
        <input
          placeholder="Nombre del espacio (ej. Trabajo, Personal)"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
    </div>
  )
}