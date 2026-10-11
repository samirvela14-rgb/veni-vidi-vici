import { useState } from 'react'
import Hoja from '../ui/Hoja'
import { valorMeta } from './base'

export default function HojaProgresoMeta({ meta, onGuardar, onCerrar }) {
  const [modo, setModo] = useState('sumar') // sumar | total
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const actual = Number(meta.valor_actual) || 0
  const objetivo = Number(meta.valor_objetivo) || 1
  const valor = Number(monto) || 0
  const nuevo = modo === 'sumar' ? actual + valor : valor
  const pctNuevo = Math.min(100, Math.round((nuevo / objetivo) * 100))

  async function guardar(e) {
    e.preventDefault()
    if (monto === '' || (modo === 'sumar' && valor <= 0)) { setError('Escribe una cantidad'); return }
    setGuardando(true)
    const ok = await onGuardar(meta, Math.max(0, nuevo))
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Hoja titulo={`${meta.emoji} ${meta.titulo}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="form-hoja">
        <div className="segmentado">
          <button type="button" className={modo === 'sumar' ? 'activo' : ''} onClick={() => { setModo('sumar'); setMonto('') }}>Sumar avance</button>
          <button type="button" className={modo === 'total' ? 'activo' : ''} onClick={() => { setModo('total'); setMonto(String(actual)) }}>Corregir total</button>
        </div>

        <label className="agregar-monto">
          {meta.tipo === 'dinero' && <span>{modo === 'sumar' ? '+ L.' : 'L.'}</span>}
          {meta.tipo !== 'dinero' && modo === 'sumar' && <span>+</span>}
          <input inputMode="decimal" placeholder="0" value={monto} autoFocus aria-label="Cantidad"
            onChange={(e) => { setMonto(e.target.value.replace(/[^0-9.]/g, '')); setError('') }} />
          {meta.tipo === 'porcentaje' && <span>%</span>}
        </label>

        <div className="meta-progreso-preview">
          <div className="barra-progreso">
            <div className={`barra-relleno ${pctNuevo >= 100 ? 'barra-completa' : ''}`} style={{ width: `${pctNuevo}%` }} />
          </div>
          <p className="texto-suave centrado">
            {valorMeta(meta.tipo, nuevo)} de {valorMeta(meta.tipo, objetivo)} · {pctNuevo}%
            {pctNuevo >= 100 && actual < objetivo && ' · ¡La completas!'}
          </p>
        </div>

        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar avance'}</button>
      </form>
    </Hoja>
  )
}
