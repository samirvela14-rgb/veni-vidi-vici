import { useCallback, useEffect, useState } from 'react'
import { Plus, Ellipsis, Check } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { otorgarXP, quitarXP, XP_TABLA } from '../xp'
import HojaMeta from './HojaMeta'
import HojaProgresoMeta from './HojaProgresoMeta'
import { valorMeta, textoDias, diasHasta } from './base'

async function traerMetas() {
  const { data, error } = await supabase.from('metas').select('*').order('creado_en', { ascending: true })
  if (error) return { error: error.message }
  return { metas: data || [] }
}

export default function Metas() {
  const [metas, setMetas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [hoja, setHoja] = useState(null) // { tipo: 'meta' | 'progreso', meta }
  const [celebrando, setCelebrando] = useState(null)

  const aplicar = useCallback((r) => {
    setCargando(false)
    if (r.error) { setError(r.error); return }
    setError('')
    setMetas(r.metas)
  }, [])

  const cargar = useCallback(() => traerMetas().then(aplicar), [aplicar])

  useEffect(() => {
    let vigente = true
    traerMetas().then((r) => { if (vigente) aplicar(r) })
    return () => { vigente = false }
  }, [aplicar])

  async function guardarMeta(datos, meta) {
    let e
    if (meta) {
      const completada = Number(meta.valor_actual) >= datos.valor_objetivo
      ;({ error: e } = await supabase.from('metas').update({ ...datos, completada }).eq('id', meta.id))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      ;({ error: e } = await supabase.from('metas').insert({ ...datos, valor_actual: 0, completada: false, user_id: user.id }))
    }
    if (e) { alert(e.message); return false }
    await cargar()
    return true
  }

  async function eliminarMeta(meta) {
    const { error: e } = await supabase.from('metas').delete().eq('id', meta.id)
    if (e) { alert(e.message); return }
    await cargar()
  }

  async function guardarProgreso(meta, valor) {
    const completada = valor >= Number(meta.valor_objetivo)
    const { error: e } = await supabase.from('metas').update({ valor_actual: valor, completada }).eq('id', meta.id)
    if (e) { alert(e.message); return false }
    await otorgarXP('meta_actualizada')
    if (completada && !meta.completada) {
      await otorgarXP('meta_completada')
      setCelebrando(meta.id)
    }
    if (!completada && meta.completada) await quitarXP('meta_completada')
    await cargar()
    return true
  }

  if (cargando) return <p className="vacio">Cargando...</p>
  if (error) return <p className="alerta">{error}</p>

  const activas = metas.filter((m) => !m.completada)
  const logradas = metas.filter((m) => m.completada)

  return (
    <div className="pm">
      <header className="tar-header">
        <h1 className="tar-titulo">Metas</h1>
        <button className="icono-btn vino" onClick={() => setHoja({ tipo: 'meta', meta: null })} aria-label="Nueva meta"><Plus size={18} /></button>
      </header>

      {celebrando && (
        <div className="meta-celebracion" role="status">
          <span className="firma">¡Vici!</span> Lograste tu meta. +{XP_TABLA.meta_completada} XP
          <button className="hoja-cerrar" onClick={() => setCelebrando(null)} aria-label="Cerrar">×</button>
        </div>
      )}

      {activas.length === 0 && (
        <section className="meta-hero sin-foto">
          <div className="meta-franja">
            <div className="meta-franja-titulo">
              <span className="meta-hero-emoji">🎯</span>
              <h2 className="meta-hero-titulo">{logradas.length ? '¿Qué sigue?' : 'Tu próxima gran meta'}</h2>
            </div>
            <div className="meta-franja-fila">
              <p className="texto-suave">Enfócate en una o dos a la vez. Ponle foto, objetivo y fecha.</p>
              <button className="boton-vino-chico meta-sumar" onClick={() => setHoja({ tipo: 'meta', meta: null })}>Crear meta</button>
            </div>
          </div>
        </section>
      )}

      {activas.map((m) => {
        const actual = Number(m.valor_actual) || 0
        const objetivo = Number(m.valor_objetivo) || 1
        const pct = Math.min(100, Math.round((actual / objetivo) * 100))
        const dias = diasHasta(m.fecha_objetivo)
        return (
          <section
            key={m.id}
            className={`meta-hero ${m.foto_url ? '' : 'sin-foto'}`}
            style={m.foto_url ? { backgroundImage: `url("${m.foto_url}")` } : undefined}
          >
            <button className="meta-hero-editar" onClick={() => setHoja({ tipo: 'meta', meta: m })} aria-label={`Editar ${m.titulo}`}>
              <Ellipsis size={18} />
            </button>

            {/* Franja de vidrio abajo: la foto se luce arriba */}
            <div className="meta-franja">
              <div className="meta-franja-fila">
                <div className="meta-franja-titulo">
                  <span className="meta-hero-emoji">{m.emoji}</span>
                  <h2 className="meta-hero-titulo">{m.titulo}</h2>
                </div>
                <div className="meta-hero-pct">{pct}<span>%</span></div>
              </div>
              <div className="barra-progreso meta-hero-barra">
                <div className="barra-relleno" style={{ width: `${pct}%` }} />
              </div>
              <div className="meta-franja-fila">
                <div className="meta-hero-datos">
                  <span>{valorMeta(m.tipo, actual)} <span className="texto-suave">de {valorMeta(m.tipo, objetivo)}</span></span>
                  <span className="texto-suave">
                    Faltan {valorMeta(m.tipo, Math.max(0, objetivo - actual))}
                    {m.fecha_objetivo && <> · <span className={dias < 0 ? 'rojo' : 'meta-hero-dias'}>{textoDias(m.fecha_objetivo).toLowerCase()}</span></>}
                  </span>
                </div>
                <button className="boton-vino-chico meta-sumar" onClick={() => setHoja({ tipo: 'progreso', meta: m })}>Sumar avance</button>
              </div>
            </div>
          </section>
        )
      })}

      {logradas.length > 0 && (
        <section className="tar-card meta-logradas">
          <span className="tar-etiqueta">Logradas</span>
          <ul>
            {logradas.map((m) => (
              <li key={m.id}>
                <button onClick={() => setHoja({ tipo: 'meta', meta: m })}>
                  <span className="meta-lograda-emoji">{m.emoji}</span>
                  <span className="meta-lograda-titulo">{m.titulo}</span>
                  <span className="texto-suave">{valorMeta(m.tipo, m.valor_objetivo)}</span>
                  <Check size={15} className="pro-terminado-check" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hoja?.tipo === 'meta' && (
        <HojaMeta key={hoja.meta?.id || 'nueva'} meta={hoja.meta} onGuardar={guardarMeta} onEliminar={eliminarMeta} onCerrar={() => setHoja(null)} />
      )}
      {hoja?.tipo === 'progreso' && (
        <HojaProgresoMeta meta={hoja.meta} onGuardar={guardarProgreso} onCerrar={() => setHoja(null)} />
      )}
    </div>
  )
}
