import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import EspaciosTrabajo from './EspaciosTrabajo'
import Tablero from './Tablero'

export default function Tareas() {
  const [espacioActivo, setEspacioActivo] = useState(null)
  const [tableroActivo, setTableroActivo] = useState(null)
  const [cargandoTablero, setCargandoTablero] = useState(false)

  async function entrarAEspacio(espacio) {
    setEspacioActivo(espacio)
    setCargandoTablero(true)

    let { data: tableros } = await supabase
      .from('tableros').select('*').eq('espacio_id', espacio.id).limit(1)

    let tablero = tableros?.[0]

    if (!tablero) {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: nuevo } = await supabase
        .from('tableros')
        .insert({ nombre: espacio.nombre, espacio_id: espacio.id, user_id: user.id })
        .select().single()
      tablero = nuevo
    }

    setTableroActivo(tablero)
    setCargandoTablero(false)
  }

  if (!espacioActivo) {
    return <EspaciosTrabajo onEntrar={entrarAEspacio} />
  }

  if (cargandoTablero || !tableroActivo) {
    return <p className="vacio">Cargando...</p>
  }

  return (
    <Tablero
      tablero={tableroActivo}
      onVolver={() => { setEspacioActivo(null); setTableroActivo(null) }}
    />
  )
}