import { useState } from 'react'
import Proyectos from './Proyectos'
import Metas from './Metas'

export default function ProyectosYMetas() {
  const [subtab, setSubtab] = useState('proyectos')

  return (
    <div className="seccion">
      <div className="subtabs">
        <button
          className={subtab === 'proyectos' ? 'activo' : ''}
          onClick={() => setSubtab('proyectos')}
        >
          Proyectos
        </button>
        <button
          className={subtab === 'metas' ? 'activo' : ''}
          onClick={() => setSubtab('metas')}
        >
          Metas
        </button>
      </div>

      {subtab === 'proyectos' ? <Proyectos /> : <Metas />}
    </div>
  )
}