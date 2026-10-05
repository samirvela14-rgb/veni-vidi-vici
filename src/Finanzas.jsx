import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { hoyISO } from './fechas'
import { otorgarXP } from './xp'

const CATEGORIAS = {
  'Obligaciones': ['Renta/Vivienda', 'Servicios', 'Celular/Plan', 'Obligaciones familiares'],
  'Comida': ['Comida calle', 'Supermercado', 'Café/Snacks'],
  'Movilidad': ['Transporte', 'Gasolina', 'Uber/Taxi'],
  'Estilo de vida': ['Entretenimiento', 'Salidas/Fiestas', 'Suscripciones', 'Ropa/Compras personales', 'Gimnasio/Deporte'],
  'Salud': ['Salud/Farmacia'],
  'Metas': ['Ahorro', 'Inversión'],
  'Otros': ['Regalos', 'Otros'],
}

function diasRestantes(fechaObjetivo) {
  if (!fechaObjetivo) return null
  const hoy = new Date(hoyISO() + 'T00:00:00')
  const meta = new Date(fechaObjetivo + 'T00:00:00')
  const dias = Math.round((meta - hoy) / (1000 * 60 * 60 * 24))
  return dias
}

export default function Finanzas() {
  const [transacciones, setTransacciones] = useState([])
  const [metas, setMetas] = useState([])
  const [tipo, setTipo] = useState('gasto')
  const [monto, setMonto] = useState('')
  const [categoriaPrincipal, setCategoriaPrincipal] = useState(Object.keys(CATEGORIAS)[0])
  const [subcategoria, setSubcategoria] = useState(CATEGORIAS[Object.keys(CATEGORIAS)[0]][0])
  const [descripcion, setDescripcion] = useState('')
  const [edicionMetas, setEdicionMetas] = useState({})

  async function cargar() {
    const [tr, mt] = await Promise.all([
      supabase.from('transacciones').select('*').order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
      supabase.from('metas_financieras').select('*').order('fecha_objetivo', { ascending: true }),
    ])
    setTransacciones(tr.data || [])
    setMetas(mt.data || [])
  }

  useEffect(() => { cargar() }, [])

  function cambiarPrincipal(valor) {
    setCategoriaPrincipal(valor)
    setSubcategoria(CATEGORIAS[valor][0])
  }

  async function agregar(e) {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('transacciones').insert({
      tipo, monto: Number(monto), categoria: categoriaPrincipal, subcategoria, descripcion, user_id: user.id,
    })
    if (error) { alert(error.message); return }
    setMonto(''); setDescripcion('')
    cargar()
  }

  async function eliminar(id) {
    await supabase.from('transacciones').delete().eq('id', id)
    cargar()
  }

  function valorMostrado(meta) {
    return edicionMetas[meta.id] ?? meta.valor_actual
  }

  function alEscribirMeta(metaId, texto) {
    setEdicionMetas({ ...edicionMetas, [metaId]: texto })
  }
  async function alSalirMeta(meta) {
    const texto = edicionMetas[meta.id]
    if (texto === undefined) return
    const valor = Number(texto) || 0
    const completada = valor >= meta.valor_objetivo
    await supabase.from('metas_financieras').update({
      valor_actual: valor, completada,
    }).eq('id', meta.id)

    await otorgarXP('meta_actualizada')
    if (completada && !meta.completada) await otorgarXP('meta_completada')

    const copia = { ...edicionMetas }
    delete copia[meta.id]
    setEdicionMetas(copia)
    cargar()
  }
  

  const { saldo, ingresos, gastos, porCategoria } = useMemo(() => {
    let ingresos = 0, gastos = 0
    const porCategoria = {}
    transacciones.forEach((t) => {
      if (t.tipo === 'ingreso') ingresos += Number(t.monto)
      else {
        gastos += Number(t.monto)
        porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + Number(t.monto)
      }
    })
    return { saldo: ingresos - gastos, ingresos, gastos, porCategoria }
  }, [transacciones])

  return (
    <div className="seccion">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-valor">L. {saldo.toLocaleString()}</span>
          <span className="stat-label">Saldo</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor verde">L. {ingresos.toLocaleString()}</span>
          <span className="stat-label">Ingresos</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor rojo">L. {gastos.toLocaleString()}</span>
          <span className="stat-label">Gastos</span>
        </div>
      </div>

      <div className="metas-financieras-grid">
        {metas.map((m) => {
          const pct = Math.min(100, Math.round((m.valor_actual / m.valor_objetivo) * 100))
          const dias = diasRestantes(m.fecha_objetivo)
          return (
            <div key={m.id} className={`meta-financiera-card ${m.completada ? 'hecho' : ''}`}>
              <div className="meta-mini-header">
                <span>{m.nombre}</span>
                <span className="verde">{pct}%</span>
              </div>
              <div className="barra-progreso">
                <div className={`barra-relleno ${m.completada ? 'barra-completa' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="meta-financiera-footer">
                <input
                  type="number"
                  value={valorMostrado(m)}
                  onChange={(e) => alEscribirMeta(m.id, e.target.value)}
                  onBlur={() => alSalirMeta(m)}
                />
                <span className="progreso-label">
                  L. {m.valor_actual.toLocaleString()} / L. {m.valor_objetivo.toLocaleString()}
                </span>
              </div>
              {dias !== null && (
                <span className="meta-financiera-dias">
                  {dias >= 0 ? `${dias} días para la meta` : `Venció hace ${Math.abs(dias)} días`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {Object.keys(porCategoria).length > 0 && (
        <div className="heatmap-card">
          <div className="heatmap-header"><span>Gastos por categoría</span></div>
          {Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
            <div key={cat} className="barra-categoria">
              <span>{cat}</span>
              <div className="barra-progreso barra-mini">
                <div className="barra-relleno" style={{ width: `${(val / gastos) * 100}%` }} />
              </div>
              <span className="progreso-label">L. {val.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={agregar} className="form-rapido form-columna">
        <div className="fila">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
          <input type="number" placeholder="Monto (L.)" value={monto}
            onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fila">
          <select value={categoriaPrincipal} onChange={(e) => cambiarPrincipal(e.target.value)}>
            {Object.keys(CATEGORIAS).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)}>
            {CATEGORIAS[categoriaPrincipal].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fila">
          <input placeholder="Descripción (opcional)" value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <button type="submit">+ Registrar</button>
      </form>

      <ul className="lista">
        {transacciones.map((t) => (
          <li key={t.id}>
            <div>
              <strong className={t.tipo === 'ingreso' ? 'verde' : 'rojo'}>
                {t.tipo === 'ingreso' ? '+' : '-'}L. {Number(t.monto).toLocaleString()}
              </strong>
              <span className="fecha"> · {t.categoria} · {t.subcategoria} · {t.fecha}</span>
              {t.descripcion && <div className="detalle">{t.descripcion}</div>}
            </div>
            <button className="borrar" onClick={() => eliminar(t.id)}>✕</button>
          </li>
        ))}
        {transacciones.length === 0 && <p className="vacio">Sin movimientos registrados.</p>}
      </ul>
    </div>
  )
}