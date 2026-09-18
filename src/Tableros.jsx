import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function Tableros({ espacio, onVolver, onEntrar }) {
  const [tableros, setTableros] = useState([])
  const [nombreNuevo, setNombreNuevo] = useState('')

  async function cargar() {
    const { data } = await supabase
      .from('tableros')
      .select('*')
      .eq('espacio_id', espacio.id)
      .order('creado_en', { ascending: false })
    setTableros(data || [])
  }

  useEffect(() => { cargar() }, [espacio.id])

  async function crear(e) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tableros').insert({
      nombre: nombreNuevo, espacio_id: espacio.id, user_id: user.id,
    })
    if (error) { alert(error.message); return }
    setNombreNuevo('')
    cargar()
  }

  async function renombrar(tablero) {
    const nuevo = prompt('Nuevo nombre:', tablero.nombre)
    if (!nuevo || !nuevo.trim()) return
    await supabase.from('tableros').update({ nombre: nuevo }).eq('id', tablero.id)
    cargar()
  }

  async function eliminar(tablero) {
    if (!confirm(`¿Eliminar el tablero "${tablero.nombre}" y todo su contenido?`)) return
    await supabase.from('tableros').delete().eq('id', tablero.id)
    cargar()
  }

  return (
    <div className="seccion">
      <div className="fila-titulo-volver">
        <button className="btn-volver" onClick={onVolver}>← Espacios</button>
        <h2 className="titulo-seccion">{espacio.nombre}</h2>
      </div>

      <div className="lista-espacios">
        {tableros.map((t) => (
          <div key={t.id} className="tarjeta-espacio">
            <button className="tarjeta-espacio-nombre" onClick={() => onEntrar(t)}>
             {t.nombre}
            </button>
            <div className="tarjeta-espacio-acciones">
              <button onClick={() => renombrar(t)}>✎</button>
              <button onClick={() => eliminar(t)}>✕</button>
            </div>
          </div>
        ))}
        {tableros.length === 0 && <p className="vacio">Este espacio aún no tiene tableros.</p>}
      </div>

      <form onSubmit={crear} className="form-rapido">
        <input
          placeholder="Nombre del tablero (ej. Sprint 1)"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
        />
        <button type="submit">+</button>
      </form>
    </div>
  )
}