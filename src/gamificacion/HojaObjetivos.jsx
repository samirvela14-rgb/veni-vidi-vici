import { useState } from 'react'
import Hoja from '../ui/Hoja'
import { hoyISO } from '../fechas'
import { MONEDAS_POR_OBJETIVO, cobrarObjetivo, finDeSemana } from './objetivos'

function diasParaElLunes(lunes) {
  const fin = new Date(finDeSemana(lunes) + 'T00:00:00')
  const hoy = new Date(hoyISO() + 'T00:00:00')
  return Math.round((fin - hoy) / 86400000)
}

export default function HojaObjetivos({ objetivos, lunes, onCambio, onCerrar }) {
  const [cobrando, setCobrando] = useState(null)
  const quedan = diasParaElLunes(lunes)

  async function cobrar(o) {
    setCobrando(o.clave)
    await cobrarObjetivo(o)
    await onCambio()
    setCobrando(null)
  }

  return (
    <Hoja titulo="Objetivos de la semana" onCerrar={onCerrar}>
      <div className="objetivos">
        <p className="texto-suave">
          {quedan === 0 ? 'Último día: se renuevan mañana.' : `Se renuevan el lunes · quedan ${quedan + 1} días.`}
          {' '}Cada uno da +{MONEDAS_POR_OBJETIVO} 🪙.
        </p>
        <ul>
          {objetivos.map((o) => (
            <li key={o.clave} className={o.cobrado ? 'cobrado' : ''}>
              <span className="objetivo-emoji">{o.emoji}</span>
              <div className="objetivo-texto">
                <span>{o.texto}</span>
                <div className="barra-con-pct">
                  <div className="barra-progreso barra-mini">
                    <div className={`barra-relleno ${o.cumplido ? 'barra-completa' : ''}`} style={{ width: `${(o.actual / o.meta) * 100}%` }} />
                  </div>
                  <span>{o.actual}/{o.meta}</span>
                </div>
              </div>
              {o.cobrado && <span className="chip-logrado">+{MONEDAS_POR_OBJETIVO} 🪙</span>}
              {o.cumplido && !o.cobrado && (
                <button className="boton-vino-chico" onClick={() => cobrar(o)} disabled={cobrando === o.clave}>
                  Cobrar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Hoja>
  )
}
