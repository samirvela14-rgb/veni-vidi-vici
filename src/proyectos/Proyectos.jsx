import { useCallback, useEffect, useState } from 'react'
import { Plus, ChevronDown, Check, Calendar } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { otorgarXP, quitarXP } from '../xp'
import Anillo from '../ui/Anillo'
import HojaProyecto from './HojaProyecto'
import { COLORES, textoDias, diasHasta } from './base'

async function traerProyectos() {
  const [pro, eta] = await Promise.all([
    supabase.from('proyectos').select('*').order('creado_en', { ascending: false }),
    supabase.from('proyecto_etapas').select('*').order('orden'),
  ])
  if (pro.error) return { error: pro.error.message }
  if (eta.error) return { error: 'Falta correr el SQL de proyectos en Supabase (tabla proyecto_etapas).' }
  return { proyectos: pro.data || [], etapas: eta.data || [] }
}

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [hoja, setHoja] = useState(null) // { id } | { nuevo: true }
  const [verTerminados, setVerTerminados] = useState(false)

  const aplicar = useCallback((r) => {
    setCargando(false)
    if (r.error) { setError(r.error); return }
    setError('')
    setProyectos(r.proyectos)
    setEtapas(r.etapas)
  }, [])

  const cargar = useCallback(() => traerProyectos().then(aplicar), [aplicar])

  useEffect(() => {
    let vigente = true
    traerProyectos().then((r) => { if (vigente) aplicar(r) })
    return () => { vigente = false }
  }, [aplicar])

  const etapasDe = (id) => etapas.filter((e) => e.proyecto_id === id)

  async function usuarioId() {
    const { data: { user } } = await supabase.auth.getUser()
    return user.id
  }

  // Ajusta estado y contadores según las etapas; da o quita XP al terminar
  async function sincronizar(proyecto, lista) {
    const total = lista.length
    const hechas = lista.filter((e) => e.hecha).length
    let estado = proyecto.estado
    if (total > 0 && hechas === total) estado = 'terminado'
    else if (hechas > 0 && estado !== 'progreso') estado = 'progreso'
    else if (hechas < total && estado === 'terminado') estado = 'progreso'

    await supabase.from('proyectos').update({ estado, etapas_total: total, etapas_hechas: hechas }).eq('id', proyecto.id)
    if (estado === 'terminado' && proyecto.estado !== 'terminado') await otorgarXP('proyecto_completado')
    if (estado !== 'terminado' && proyecto.estado === 'terminado') await quitarXP('proyecto_completado')
  }

  async function alternarEtapa(etapa) {
    const proyecto = proyectos.find((p) => p.id === etapa.proyecto_id)
    const hecha = !etapa.hecha
    setEtapas((prev) => prev.map((e) => (e.id === etapa.id ? { ...e, hecha } : e)))
    await supabase.from('proyecto_etapas')
      .update({ hecha, hecha_en: hecha ? new Date().toISOString() : null }).eq('id', etapa.id)
    await (hecha ? otorgarXP('proyecto_etapa') : quitarXP('proyecto_etapa'))
    await sincronizar(proyecto, etapasDe(proyecto.id).map((e) => (e.id === etapa.id ? { ...e, hecha } : e)))
    await cargar()
  }

  async function agregarEtapa(proyecto, nombre) {
    const lista = etapasDe(proyecto.id)
    const orden = lista.length ? Math.max(...lista.map((e) => e.orden)) + 1 : 1
    const { data, error: e } = await supabase.from('proyecto_etapas')
      .insert({ proyecto_id: proyecto.id, nombre, orden, user_id: await usuarioId() }).select().single()
    if (e) { alert(e.message); return }
    await sincronizar(proyecto, [...lista, data])
    await cargar()
  }

  async function borrarEtapa(etapa) {
    const proyecto = proyectos.find((p) => p.id === etapa.proyecto_id)
    await supabase.from('proyecto_etapas').delete().eq('id', etapa.id)
    await sincronizar(proyecto, etapasDe(proyecto.id).filter((e) => e.id !== etapa.id))
    await cargar()
  }

  async function guardarProyecto(datos, proyecto, etapasNuevas) {
    if (proyecto) {
      const { error: e } = await supabase.from('proyectos').update(datos).eq('id', proyecto.id)
      if (e) { alert(e.message); return false }
    } else {
      const userId = await usuarioId()
      const { data: nuevo, error: e } = await supabase.from('proyectos')
        .insert({ ...datos, etapas_total: etapasNuevas.length, etapas_hechas: 0, user_id: userId })
        .select().single()
      if (e) { alert(e.message); return false }
      if (etapasNuevas.length) {
        const { error: e2 } = await supabase.from('proyecto_etapas').insert(
          etapasNuevas.map((nombre, i) => ({ proyecto_id: nuevo.id, nombre, orden: i + 1, user_id: userId }))
        )
        if (e2) alert(e2.message)
      }
    }
    await cargar()
    return true
  }

  async function eliminarProyecto(proyecto) {
    const { error: e } = await supabase.from('proyectos').delete().eq('id', proyecto.id)
    if (e) { alert(e.message); return }
    await cargar()
  }

  if (cargando) return <p className="vacio">Cargando...</p>
  if (error) return <p className="alerta">{error}</p>

  const enProgreso = proyectos.filter((p) => p.estado === 'progreso')
  const pendientes = proyectos.filter((p) => p.estado !== 'progreso' && p.estado !== 'terminado')
  const terminados = proyectos.filter((p) => p.estado === 'terminado')
  const activos = [...enProgreso, ...pendientes]
  const etapasActivas = etapas.filter((e) => activos.some((p) => p.id === e.proyecto_id))
  const pctGeneral = etapasActivas.length
    ? Math.round((etapasActivas.filter((e) => e.hecha).length / etapasActivas.length) * 100) : 0
  const proximaFecha = activos.filter((p) => p.fecha_objetivo)
    .sort((a, b) => a.fecha_objetivo.localeCompare(b.fecha_objetivo))[0]

  function tarjeta(p, grande) {
    const lista = etapasDe(p.id)
    const hechas = lista.filter((e) => e.hecha).length
    const pct = lista.length ? Math.round((hechas / lista.length) * 100) : 0
    const siguiente = lista.find((e) => !e.hecha)
    const dias = diasHasta(p.fecha_objetivo)
    return (
      <article key={p.id} className={`pro-card ${grande ? 'grande' : ''}`} style={{ '--c': COLORES[p.color] || COLORES.violeta }}>
        <button className="pro-card-cuerpo" onClick={() => setHoja({ id: p.id })}>
          <div className="pro-card-top">
            {p.etiqueta && <span className="pro-etiqueta">{p.etiqueta}</span>}
            {p.fecha_objetivo && (
              <span className={`pro-fecha ${dias < 0 ? 'vencida' : dias <= 7 ? 'pronto' : ''}`}>
                <Calendar size={12} /> {textoDias(p.fecha_objetivo)}
              </span>
            )}
          </div>
          <h3 className="pro-nombre">{p.nombre}</h3>
          {grande && p.descripcion && <p className="pro-descripcion">{p.descripcion}</p>}
          <div className="barra-con-pct">
            <div className="barra-progreso barra-mini">
              <div className="barra-relleno pro-relleno" style={{ width: `${pct}%` }} />
            </div>
            <span>{lista.length ? `${hechas}/${lista.length}` : 'Sin etapas'}</span>
          </div>
        </button>
        {siguiente && (
          <div className="pro-siguiente">
            <button className="pro-siguiente-check" onClick={() => alternarEtapa(siguiente)} aria-label={`Marcar ${siguiente.nombre} como hecha`}>
              <Check size={13} strokeWidth={3} />
            </button>
            <span><span className="texto-suave">Siguiente:</span> {siguiente.nombre}</span>
          </div>
        )}
      </article>
    )
  }

  const proyectoAbierto = hoja?.id && proyectos.find((p) => p.id === hoja.id)

  return (
    <div className="pm">
      <header className="tar-header">
        <h1 className="tar-titulo">Proyectos</h1>
        <button className="icono-btn vino" onClick={() => setHoja({ nuevo: true })} aria-label="Nuevo proyecto"><Plus size={18} /></button>
      </header>

      {proyectos.length === 0 ? (
        <section className="tar-card tar-bienvenida">
          <h2>Tu primer proyecto</h2>
          <p className="texto-suave">Divídelo en etapas con nombre y ve marcando cada una. Cada etapa te da XP, y terminar el proyecto te da un bono.</p>
          <button className="boton-grande" onClick={() => setHoja({ nuevo: true })}>Crear proyecto</button>
        </section>
      ) : (
        <>
          <section className="tar-card tar-hoy">
            <Anillo pct={pctGeneral} texto={`${pctGeneral}%`} />
            <div>
              <span className="tar-card-titulo">Avance general</span>
              <span className="texto-suave">
                {[
                  enProgreso.length && `${enProgreso.length} en progreso`,
                  pendientes.length && `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`,
                  terminados.length && `${terminados.length} terminado${terminados.length === 1 ? '' : 's'}`,
                ].filter(Boolean).join(' · ')}
              </span>
              {proximaFecha && (
                <span className="texto-suave">Próxima entrega: {proximaFecha.nombre} · {textoDias(proximaFecha.fecha_objetivo).toLowerCase()}</span>
              )}
            </div>
          </section>

          {enProgreso.length > 0 && (
            <>
              <span className="tar-etiqueta pm-seccion">En progreso</span>
              <div className="pro-lista">{enProgreso.map((p) => tarjeta(p, true))}</div>
            </>
          )}

          {pendientes.length > 0 && (
            <>
              <span className="tar-etiqueta pm-seccion">Pendientes</span>
              <div className="pro-lista pro-grid">{pendientes.map((p) => tarjeta(p, false))}</div>
            </>
          )}

          {terminados.length > 0 && (
            <section className="tar-card pro-terminados">
              <button className="pro-terminados-toggle" onClick={() => setVerTerminados(!verTerminados)} aria-expanded={verTerminados}>
                <span>Terminados <span className="texto-suave">{terminados.length}</span></span>
                <ChevronDown size={16} className={verTerminados ? 'girado' : ''} />
              </button>
              {verTerminados && (
                <ul>
                  {terminados.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setHoja({ id: p.id })}>
                        <span className="pro-punto" style={{ '--c': COLORES[p.color] || COLORES.violeta }} />
                        <span className="pro-terminado-nombre">{p.nombre}</span>
                        <Check size={15} className="pro-terminado-check" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {hoja && (hoja.nuevo || proyectoAbierto) && (
        <HojaProyecto
          key={hoja.id || 'nuevo'}
          proyecto={proyectoAbierto || null}
          etapas={proyectoAbierto ? etapasDe(proyectoAbierto.id) : []}
          onGuardar={guardarProyecto}
          onEliminar={eliminarProyecto}
          onAlternarEtapa={alternarEtapa}
          onAgregarEtapa={agregarEtapa}
          onBorrarEtapa={borrarEtapa}
          onCerrar={() => setHoja(null)}
        />
      )}
    </div>
  )
}
