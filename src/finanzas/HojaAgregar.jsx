import { useState } from 'react'
import { Calendar } from 'lucide-react'
import Hoja from '../ui/Hoja'
import { abrirCalendario } from '../ui/abrirCalendario'
import Icono from './Icono'
import { GRUPOS_GASTO, fechaCorta } from './base'
import { hoyISO } from '../fechas'

export default function HojaAgregar({ categorias, tipoInicial = 'gasto', onGuardar, onCerrar }) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState(null)
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Los abonos al ahorro se hacen desde Metas para que cuadren con cada meta
  const grupos = tipo === 'gasto'
    ? GRUPOS_GASTO.filter((g) => g !== 'Ahorro')
    : ['Ingresos']

  function cambiarTipo(nuevo) {
    setTipo(nuevo)
    setCategoriaId(null)
    setError('')
  }

  function alEscribirMonto(texto) {
    setMonto(texto.replace(/[^0-9.]/g, ''))
    setError('')
  }

  async function guardar(e) {
    e.preventDefault()
    const valor = Number(monto)
    if (!valor || valor <= 0) { setError('Escribe un monto mayor a 0'); return }
    if (!categoriaId) { setError('Elige una categoría'); return }
    setGuardando(true)
    const ok = await onGuardar({
      tipo, monto: valor, categoria: categorias.find((c) => c.id === categoriaId), fecha, nota,
    })
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Hoja onCerrar={onCerrar} titulo="">
      <form onSubmit={guardar} className="agregar">
        <div className="segmentado">
          <button type="button" className={tipo === 'gasto' ? 'activo' : ''} onClick={() => cambiarTipo('gasto')}>Gasto</button>
          <button type="button" className={tipo === 'ingreso' ? 'activo' : ''} onClick={() => cambiarTipo('ingreso')}>Ingreso</button>
        </div>

        <label className="agregar-monto">
          <span>L.</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={monto}
            onChange={(e) => alEscribirMonto(e.target.value)}
            autoFocus
            aria-label="Monto"
          />
        </label>

        <label className="agregar-fecha" onClick={abrirCalendario}>
          <Calendar size={14} />
          {fecha === hoyISO() ? `Hoy · ${fechaCorta(fecha)}` : fechaCorta(fecha)}
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value || hoyISO())} />
        </label>

        {grupos.map((g) => {
          const lista = categorias.filter((c) => c.grupo === g && c.tipo === tipo)
          if (lista.length === 0) return null
          return (
            <div key={g} className="agregar-grupo">
              <span className="etiqueta-grupo">{g}</span>
              <div className="chips">
                {lista.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`chip-cat ${categoriaId === c.id ? 'activo' : ''}`}
                    onClick={() => { setCategoriaId(c.id); setError('') }}
                  >
                    <Icono nombre={c.icono} size={20} />
                    <span>{c.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}

        <input
          className="agregar-nota"
          placeholder="Nota (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />

        {error && <p className="error-inline">{error}</p>}

        <button type="submit" className="boton-grande" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </Hoja>
  )
}
