import { Trash2 } from 'lucide-react'
import Hoja from '../ui/Hoja'
import Icono from './Icono'
import { lempiras, fechaCorta, nombreMes } from './base'

export default function Movimientos({ mes, transacciones, categorias, onEliminar, onCerrar }) {
  const porId = Object.fromEntries(categorias.map((c) => [c.id, c]))

  async function eliminar(t) {
    const aviso = t.meta_id ? ' También se descontará de su meta.' : ''
    if (!confirm(`¿Eliminar este movimiento de ${lempiras(t.monto)}?${aviso}`)) return
    await onEliminar(t)
  }

  return (
    <Hoja titulo={`Movimientos · ${nombreMes(mes)}`} onCerrar={onCerrar}>
      {transacciones.length === 0 && <p className="vacio">Aún no hay movimientos este mes.</p>}
      <ul className="movs">
        {transacciones.map((t) => {
          const cat = porId[t.categoria_id]
          const esIngreso = t.tipo === 'ingreso'
          return (
            <li key={t.id}>
              <span className={`mov-icono ${esIngreso ? 'ingreso' : ''}`}>
                <Icono nombre={cat?.icono} size={18} />
              </span>
              <div className="mov-texto">
                <span>{t.subcategoria || cat?.nombre || t.categoria}</span>
                <span className="texto-suave">
                  {fechaCorta(t.fecha)} · {t.categoria}{t.descripcion ? ` · ${t.descripcion}` : ''}
                </span>
              </div>
              <span className={`mov-monto ${esIngreso ? 'verde' : ''}`}>
                {esIngreso ? '+' : '-'}{lempiras(t.monto).replace('-', '')}
              </span>
              <button className="borrar" onClick={() => eliminar(t)} aria-label="Eliminar"><Trash2 size={15} /></button>
            </li>
          )
        })}
      </ul>
    </Hoja>
  )
}
