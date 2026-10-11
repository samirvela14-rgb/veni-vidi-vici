import { useState } from 'react'
import Proyectos from './proyectos/Proyectos'
import Metas from './proyectos/Metas'
import './proyectos/proyectos.css'

const CLAVE = 'vvv-subtab-proyectos'

function leerSubtab() {
  try { return localStorage.getItem(CLAVE) === 'metas' ? 'metas' : 'proyectos' } catch { return 'proyectos' }
}

export default function ProyectosYMetas() {
  const [subtab, setSubtab] = useState(leerSubtab)

  function cambiar(valor) {
    setSubtab(valor)
    try { localStorage.setItem(CLAVE, valor) } catch { /* sin almacenamiento: no pasa nada */ }
  }

  return (
    <div className="pm-contenedor">
      <div className="segmentado pm-selector">
        <button className={subtab === 'proyectos' ? 'activo' : ''} onClick={() => cambiar('proyectos')}>Proyectos</button>
        <button className={subtab === 'metas' ? 'activo' : ''} onClick={() => cambiar('metas')}>Metas</button>
      </div>
      {subtab === 'proyectos' ? <Proyectos /> : <Metas />}
    </div>
  )
}
