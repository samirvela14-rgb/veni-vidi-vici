import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Hoja from '../ui/Hoja'
import Icono from './Icono'
import { ICONOS } from './iconos'
import { GRUPOS_GASTO, lempiras } from './base'

const ICONOS_ELEGIBLES = Object.keys(ICONOS).filter((n) => n !== 'circle')

export default function MiPresupuesto({ categorias, config, onGuardar, onCerrar }) {
  const [filas, setFilas] = useState(() => categorias.map((c) => ({ ...c, monto_planeado: String(c.monto_planeado) })))
  const [conf, setConf] = useState({
    ingreso_referencia: String(config.ingreso_referencia),
    ahorro_minimo_pct: String(config.ahorro_minimo_pct),
    entretenimiento_max_pct: String(config.entretenimiento_max_pct),
  })
  const [nuevaEn, setNuevaEn] = useState(null) // grupo donde se está agregando
  const [nueva, setNueva] = useState({ nombre: '', icono: 'circle', monto: '' })
  const [eliminadas, setEliminadas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const ingreso = Number(conf.ingreso_referencia) || 0
  const totalGrupo = (g) => filas.filter((f) => f.grupo === g).reduce((s, f) => s + (Number(f.monto_planeado) || 0), 0)
  const asignado = GRUPOS_GASTO.reduce((s, g) => s + totalGrupo(g), 0)
  const sinAsignar = ingreso - asignado
  const pct = (n) => (ingreso ? Math.round((n / ingreso) * 100) : 0)

  const pctAhorro = pct(totalGrupo('Ahorro'))
  const pctEntret = pct(totalGrupo('Entretenimiento'))

  function cambiarFila(id, campo, valor) {
    setFilas(filas.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)))
  }

  function quitar(fila) {
    setFilas(filas.filter((f) => f.id !== fila.id))
    if (!String(fila.id).startsWith('nueva-')) setEliminadas([...eliminadas, fila.id])
  }

  function agregar(grupo) {
    if (!nueva.nombre.trim()) return
    setFilas([...filas, {
      id: `nueva-${Date.now()}`, tipo: grupo === 'Ingresos' ? 'ingreso' : 'gasto', grupo,
      nombre: nueva.nombre.trim(), icono: nueva.icono, monto_planeado: nueva.monto || '0',
    }])
    setNueva({ nombre: '', icono: 'circle', monto: '' })
    setNuevaEn(null)
  }

  async function guardar() {
    if (filas.some((f) => !f.nombre.trim())) { setError('Hay una categoría sin nombre'); return }
    setGuardando(true)
    const ok = await onGuardar({ filas, eliminadas, conf })
    setGuardando(false)
    if (ok) onCerrar()
  }

  return (
    <Hoja titulo="Mi presupuesto" onCerrar={onCerrar}>
      <div className="presu">
        <div className="presu-resumen">
          <label className="campo">
            <span>Ingreso mensual de referencia (L.)</span>
            <input inputMode="decimal" value={conf.ingreso_referencia}
              onChange={(e) => setConf({ ...conf, ingreso_referencia: e.target.value.replace(/[^0-9.]/g, '') })} />
          </label>
          <div className="presu-reparto">
            {GRUPOS_GASTO.map((g) => totalGrupo(g) > 0 && (
              <span key={g}><b>{pct(totalGrupo(g))}%</b> {g}</span>
            ))}
          </div>
          <p className={`texto-suave ${sinAsignar < 0 ? 'rojo' : ''}`}>
            {sinAsignar === 0 && 'Todo tu ingreso está asignado.'}
            {sinAsignar > 0 && `Te quedan ${lempiras(sinAsignar)} sin asignar.`}
            {sinAsignar < 0 && `Te pasaste por ${lempiras(-sinAsignar)} de tu ingreso.`}
          </p>
        </div>

        <div className="presu-reglas">
          <label className="campo">
            <span>Ahorro mínimo %</span>
            <input inputMode="numeric" value={conf.ahorro_minimo_pct}
              onChange={(e) => setConf({ ...conf, ahorro_minimo_pct: e.target.value.replace(/[^0-9.]/g, '') })} />
          </label>
          <label className="campo">
            <span>Entretenimiento máx. %</span>
            <input inputMode="numeric" value={conf.entretenimiento_max_pct}
              onChange={(e) => setConf({ ...conf, entretenimiento_max_pct: e.target.value.replace(/[^0-9.]/g, '') })} />
          </label>
        </div>
        {pctAhorro < Number(conf.ahorro_minimo_pct) && (
          <p className="alerta">Tu ahorro planeado es {pctAhorro}%, debajo de tu mínimo de {conf.ahorro_minimo_pct}%.</p>
        )}
        {pctEntret > Number(conf.entretenimiento_max_pct) && (
          <p className="alerta">Entretenimiento planeado en {pctEntret}%, arriba de tu máximo de {conf.entretenimiento_max_pct}%.</p>
        )}

        {[...GRUPOS_GASTO, 'Ingresos'].map((g) => (
          <div key={g} className="presu-grupo">
            <div className="presu-grupo-header">
              <span>{g}</span>
              {g !== 'Ingresos' && <span className="texto-suave">{lempiras(totalGrupo(g))}</span>}
            </div>
            {filas.filter((f) => f.grupo === g).map((f) => (
              <div key={f.id} className="presu-fila">
                <Icono nombre={f.icono} size={18} />
                <input className="presu-nombre" value={f.nombre} onChange={(e) => cambiarFila(f.id, 'nombre', e.target.value)} aria-label="Nombre" />
                {g !== 'Ingresos' && (
                  <input className="presu-monto" inputMode="decimal" value={f.monto_planeado} aria-label="Monto planeado"
                    onChange={(e) => cambiarFila(f.id, 'monto_planeado', e.target.value.replace(/[^0-9.]/g, ''))} />
                )}
                <button className="borrar" onClick={() => quitar(f)} aria-label="Quitar"><Trash2 size={15} /></button>
              </div>
            ))}

            {nuevaEn === g ? (
              <div className="presu-nueva">
                <div className="iconos-elegir">
                  {ICONOS_ELEGIBLES.map((n) => (
                    <button key={n} type="button" className={nueva.icono === n ? 'activo' : ''}
                      onClick={() => setNueva({ ...nueva, icono: n })} aria-label={n}>
                      <Icono nombre={n} size={16} />
                    </button>
                  ))}
                </div>
                <div className="presu-fila">
                  <Icono nombre={nueva.icono} size={18} />
                  <input className="presu-nombre" placeholder="Nombre" value={nueva.nombre} autoFocus
                    onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
                  {g !== 'Ingresos' && (
                    <input className="presu-monto" placeholder="0" inputMode="decimal" value={nueva.monto}
                      onChange={(e) => setNueva({ ...nueva, monto: e.target.value.replace(/[^0-9.]/g, '') })} />
                  )}
                </div>
                <div className="fila-botones">
                  <button className="boton-secundario" onClick={() => setNuevaEn(null)}>Cancelar</button>
                  <button className="boton-lila" onClick={() => agregar(g)}>Agregar</button>
                </div>
              </div>
            ) : (
              <button className="link-violeta" onClick={() => { setNuevaEn(g); setNueva({ nombre: '', icono: 'circle', monto: '' }) }}>
                <Plus size={14} /> Agregar a {g}
              </button>
            )}
          </div>
        ))}

        {error && <p className="error-inline">{error}</p>}
        <button className="boton-grande" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </Hoja>
  )
}
