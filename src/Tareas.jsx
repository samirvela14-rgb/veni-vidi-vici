import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ChevronRight, Ellipsis, Circle, CircleCheck, Bell } from 'lucide-react'
import { supabase } from './supabaseClient'
import { ejecutar } from './offline/cola'
import { hoyISO, sumarDias } from './fechas'
import Anillo from './ui/Anillo'
import Tablero from './tareas/Tablero'
import HojaTarea from './tareas/HojaTarea'
import HojaNuevaTarea from './tareas/HojaNuevaTarea'
import HojaEspacio from './tareas/HojaEspacio'
import HojaNotificaciones from './notificaciones/HojaNotificaciones'
import { esColumnaHecha, estadoFecha, etiquetaFecha, tableroDeEspacio, crearColumnasBase, formatoHora, porFechaYHora } from './tareas/base'
import './tareas/tareas.css'

const MAX_PROXIMAS = 5
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fechaLarga() {
  const d = new Date()
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

async function traerTodo() {
  const [esp, tab, col, tar, chk] = await Promise.all([
    supabase.from('espacios_trabajo').select('*').order('creado_en', { ascending: true }),
    supabase.from('tableros').select('*'),
    supabase.from('columnas').select('*').order('orden'),
    supabase.from('tarjetas').select('*').order('orden'),
    supabase.from('checklist_items').select('tarjeta_id, hecho'),
  ])
  const fallo = [esp, tab, col, tar].find((r) => r.error)
  if (fallo) return { error: fallo.error.message }
  return { espacios: esp.data || [], tableros: tab.data || [], columnas: col.data || [], tarjetas: tar.data || [], checklist: chk.data || [] }
}

export default function Tareas() {
  const [espacios, setEspacios] = useState([])
  const [tableros, setTableros] = useState([])
  const [columnas, setColumnas] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [checklist, setChecklist] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [espacioAbierto, setEspacioAbierto] = useState(null)
  const [hoja, setHoja] = useState(null) // { tipo: 'tarea'|'nueva'|'espacio', ... }

  const aplicar = useCallback((r) => {
    setCargando(false)
    if (r.error) { setError(r.error); return }
    setError('')
    setEspacios(r.espacios)
    setTableros(r.tableros)
    setColumnas(r.columnas)
    setTarjetas(r.tarjetas)
    setChecklist(r.checklist)
  }, [])

  const cargar = useCallback(() => traerTodo().then(aplicar), [aplicar])

  useEffect(() => {
    let vigente = true
    traerTodo().then((r) => { if (vigente) aplicar(r) })
    return () => { vigente = false }
  }, [aplicar])

  // ---------- Relaciones ----------
  const datos = useMemo(() => {
    const tableroDe = {}
    tableros.forEach((t) => { if (!tableroDe[t.espacio_id]) tableroDe[t.espacio_id] = t })
    const columnaPorId = Object.fromEntries(columnas.map((c) => [c.id, c]))
    const espacioDeTablero = Object.fromEntries(tableros.map((t) => [t.id, espacios.find((e) => e.id === t.espacio_id)]))
    const conteos = {}
    checklist.forEach((i) => {
      conteos[i.tarjeta_id] ??= { total: 0, hechos: 0 }
      conteos[i.tarjeta_id].total++
      if (i.hecho) conteos[i.tarjeta_id].hechos++
    })
    const enriquecidas = tarjetas.map((t) => {
      const col = columnaPorId[t.columna_id]
      return { ...t, columna: col, espacio: col && espacioDeTablero[col.tablero_id], hecha: col ? esColumnaHecha(col.nombre) : false }
    }).filter((t) => t.espacio)
    return { tableroDe, columnaPorId, conteos, enriquecidas }
  }, [espacios, tableros, columnas, tarjetas, checklist])

  const columnasDeEspacio = useCallback((espacioId) => {
    const tablero = datos.tableroDe[espacioId]
    return tablero ? columnas.filter((c) => c.tablero_id === tablero.id) : []
  }, [datos, columnas])

  function columnaHechaDe(tarjeta) {
    return columnas.find((c) => c.tablero_id === tarjeta.columna?.tablero_id && esColumnaHecha(c.nombre))
  }

  // ---------- Acciones ----------
  // Se lee de la sesión guardada (no de la red) para que funcione sin internet
  async function usuarioId() {
    const { data: { session } } = await supabase.auth.getSession()
    return session.user.id
  }

  // Al entrar o salir de la columna "Hecho": guarda cuándo se completó y da o quita XP
  // (+5 por tarea, +10 extra si se terminó a tiempo). Crear una tarea ya hecha no da XP.
  // Devuelve true si quedó pendiente (sin internet).
  async function registrarCompletado(tarjeta, columnaDestinoId) {
    const destino = columnas.find((c) => c.id === columnaDestinoId)
    const entraAHecho = destino && esColumnaHecha(destino.nombre)
    const aTiempo = tarjeta.fecha_limite && hoyISO() <= tarjeta.fecha_limite
    const motivos = aTiempo ? ['tarea', 'tarea_a_tiempo'] : ['tarea']
    let r = null
    if (entraAHecho && !tarjeta.completada_en) {
      r = await ejecutar({
        tabla: 'tarjetas', accion: 'update', filtro: { id: tarjeta.id },
        datos: { completada_en: new Date().toISOString() }, xp: { otorgar: motivos },
      })
    } else if (!entraAHecho && tarjeta.completada_en) {
      r = await ejecutar({
        tabla: 'tarjetas', accion: 'update', filtro: { id: tarjeta.id },
        datos: { completada_en: null }, xp: { quitar: motivos },
      })
    }
    return !!r?.pendiente // si falla (falta el SQL de gamificación) simplemente no hay XP
  }

  function siguienteOrden(columnaId) {
    const enCol = tarjetas.filter((t) => t.columna_id === columnaId)
    return enCol.length ? Math.max(...enCol.map((t) => t.orden || 0)) + 1 : 1
  }

  async function crearTarea({ titulo, espacio, columnaId, fecha, hora }) {
    try {
      let destino = columnaId
      if (!destino) {
        const tablero = await tableroDeEspacio(espacio)
        const { data: cols } = await supabase.from('columnas').select('*').eq('tablero_id', tablero.id).order('orden')
        destino = cols?.[0]?.id
        if (!destino) {
          await crearColumnasBase(tablero.id, await usuarioId())
          const { data: nuevas } = await supabase.from('columnas').select('*').eq('tablero_id', tablero.id).order('orden')
          destino = nuevas?.[0]?.id
        }
      }
      const nueva = {
        id: crypto.randomUUID(), titulo, columna_id: destino, fecha_limite: fecha,
        user_id: await usuarioId(), orden: siguienteOrden(destino), ...(hora && { hora }),
      }
      const r = await ejecutar({ tabla: 'tarjetas', accion: 'insert', datos: nueva })
      if (!r.ok) throw new Error(r.error)
      if (r.pendiente) setTarjetas((prev) => [...prev, nueva])
      else await cargar()
      return true
    } catch (err) {
      alert(err.message)
      return false
    }
  }

  async function agregarRapido(columnaId, titulo) {
    const nueva = { id: crypto.randomUUID(), titulo, columna_id: columnaId, user_id: await usuarioId(), orden: siguienteOrden(columnaId) }
    const r = await ejecutar({ tabla: 'tarjetas', accion: 'insert', datos: nueva })
    if (!r.ok) { alert(r.error); return }
    if (r.pendiente) setTarjetas((prev) => [...prev, nueva])
    else await cargar()
  }

  async function guardarTarea(tarjeta, cambios) {
    const datosNuevos = { ...cambios }
    if (cambios.columna_id !== tarjeta.columna_id) datosNuevos.orden = siguienteOrden(cambios.columna_id)
    const r = await ejecutar({ tabla: 'tarjetas', accion: 'update', datos: datosNuevos, filtro: { id: tarjeta.id } })
    if (!r.ok) { alert(r.error); return false }
    let pendiente = r.pendiente
    if (cambios.columna_id !== tarjeta.columna_id) {
      pendiente = (await registrarCompletado({ ...tarjeta, fecha_limite: cambios.fecha_limite }, cambios.columna_id)) || pendiente
    }
    if (pendiente) setTarjetas((prev) => prev.map((t) => (t.id === tarjeta.id ? { ...t, ...datosNuevos } : t)))
    else await cargar()
    return true
  }

  async function eliminarTarea(tarjeta) {
    const { error: e } = await supabase.from('tarjetas').delete().eq('id', tarjeta.id)
    if (e) { alert(e.message); return }
    await cargar()
  }

  // Marcar como hecha desde el inicio: la mueve a la columna "Hecho" de su tablero
  async function completar(tarjeta) {
    const hecha = columnaHechaDe(tarjeta)
    if (!hecha) return
    setTarjetas((prev) => prev.map((t) => (t.id === tarjeta.id ? { ...t, columna_id: hecha.id, completada_en: t.completada_en || 'pendiente' } : t)))
    const r = await ejecutar({
      tabla: 'tarjetas', accion: 'update', filtro: { id: tarjeta.id },
      datos: { columna_id: hecha.id, orden: siguienteOrden(hecha.id) },
    })
    if (!r.ok) { alert(r.error); await cargar(); return }
    const pendiente = (await registrarCompletado(tarjeta, hecha.id)) || r.pendiente
    if (!pendiente) await cargar()
  }

  async function persistirOrden(tarjetaId, columnaId, ordenados) {
    const tarjeta = tarjetas.find((t) => t.id === tarjetaId)
    const r = await ejecutar({ tabla: 'tarjetas', accion: 'update', datos: { columna_id: columnaId }, filtro: { id: tarjetaId } })
    let pendiente = r.pendiente
    if (tarjeta) pendiente = (await registrarCompletado(tarjeta, columnaId)) || pendiente
    const resultados = await Promise.all(ordenados.map((id, i) =>
      ejecutar({ tabla: 'tarjetas', accion: 'update', datos: { orden: i }, filtro: { id } })))
    pendiente = resultados.some((x) => x.pendiente) || pendiente
    // Sin internet la pantalla ya muestra el cambio; con internet se recarga
    if (pendiente) setTarjetas((prev) => prev.map((t) => (ordenados.includes(t.id) ? { ...t, orden: ordenados.indexOf(t.id) } : t)))
    else await cargar()
  }

  async function guardarEspacio(nombre, espacio) {
    if (espacio) {
      const { error: e } = await supabase.from('espacios_trabajo').update({ nombre }).eq('id', espacio.id)
      if (e) { alert(e.message); return false }
      if (espacioAbierto?.id === espacio.id) setEspacioAbierto({ ...espacio, nombre })
    } else {
      const { data: nuevo, error: e } = await supabase.from('espacios_trabajo')
        .insert({ nombre, user_id: await usuarioId() }).select().single()
      if (e) { alert(e.message); return false }
      try { await tableroDeEspacio(nuevo) } catch (err) { alert(err.message) }
    }
    await cargar()
    return true
  }

  async function eliminarEspacio(espacio) {
    const { error: e } = await supabase.from('espacios_trabajo').delete().eq('id', espacio.id)
    if (e) { alert(e.message); return }
    if (espacioAbierto?.id === espacio.id) setEspacioAbierto(null)
    await cargar()
  }

  async function abrirEspacio(espacio) {
    try {
      if (!datos.tableroDe[espacio.id]) { await tableroDeEspacio(espacio); await cargar() }
      setEspacioAbierto(espacio)
    } catch (err) {
      alert(err.message)
    }
  }

  async function crearColumna(nombre) {
    const tablero = datos.tableroDe[espacioAbierto.id]
    const propias = columnas.filter((c) => c.tablero_id === tablero.id)
    const maxOrden = propias.length ? Math.max(...propias.map((c) => c.orden || 0)) : 0
    const { error: e } = await supabase.from('columnas').insert({
      nombre, tablero_id: tablero.id, user_id: await usuarioId(), orden: maxOrden + 1,
    })
    if (e) { alert(e.message); return }
    await cargar()
  }

  async function renombrarColumna(columna, nombre) {
    await supabase.from('columnas').update({ nombre }).eq('id', columna.id)
    await cargar()
  }

  async function eliminarColumna(columna) {
    const cuantas = tarjetas.filter((t) => t.columna_id === columna.id).length
    const aviso = cuantas ? ` y sus ${cuantas} tarea${cuantas === 1 ? '' : 's'}` : ''
    if (!confirm(`¿Eliminar la columna "${columna.nombre}"${aviso}?`)) return
    await supabase.from('columnas').delete().eq('id', columna.id)
    await cargar()
  }

  async function columnasBase() {
    try {
      await crearColumnasBase(datos.tableroDe[espacioAbierto.id].id, await usuarioId())
      await cargar()
    } catch (err) {
      alert(err.message)
    }
  }

  // ---------- Hojas (ventanitas) ----------
  const cerrarHoja = () => setHoja(null)
  const hojaActual = hoja && (() => {
    if (hoja.tipo === 'tarea') {
      const tarjeta = tarjetas.find((t) => t.id === hoja.id)
      if (!tarjeta) return null
      const col = datos.columnaPorId[tarjeta.columna_id]
      return (
        <HojaTarea
          key={tarjeta.id}
          tarjeta={tarjeta}
          columnas={columnas.filter((c) => c.tablero_id === col?.tablero_id)}
          onGuardar={guardarTarea}
          onEliminar={eliminarTarea}
          onChecklist={cargar}
          onCerrar={cerrarHoja}
        />
      )
    }
    if (hoja.tipo === 'nueva') {
      return (
        <HojaNuevaTarea
          espacios={espacios}
          columnasDe={columnasDeEspacio}
          espacioInicial={hoja.espacioId}
          columnaInicial={hoja.columnaId}
          onCrear={crearTarea}
          onCerrar={cerrarHoja}
        />
      )
    }
    if (hoja.tipo === 'notificaciones') return <HojaNotificaciones onCerrar={cerrarHoja} />
    if (hoja.tipo === 'espacio') {
      return <HojaEspacio espacio={hoja.espacio} onGuardar={guardarEspacio} onEliminar={eliminarEspacio} onCerrar={cerrarHoja} />
    }
    return null
  })()

  // ---------- Render ----------
  if (cargando) return <p className="vacio">Cargando...</p>
  if (error) return <div className="tar"><p className="alerta">No se pudo cargar Tareas: {error}</p></div>

  if (espacioAbierto) {
    const tablero = datos.tableroDe[espacioAbierto.id]
    const colsTablero = tablero ? columnas.filter((c) => c.tablero_id === tablero.id) : []
    const idsCols = new Set(colsTablero.map((c) => c.id))
    return (
      <>
        <Tablero
          espacio={espacioAbierto}
          columnas={colsTablero}
          tarjetas={tarjetas.filter((t) => idsCols.has(t.columna_id))}
          conteos={datos.conteos}
          setTarjetas={setTarjetas}
          onVolver={() => setEspacioAbierto(null)}
          onEditarEspacio={() => setHoja({ tipo: 'espacio', espacio: espacioAbierto })}
          onNuevaTarea={(columnaId) => setHoja({ tipo: 'nueva', espacioId: espacioAbierto.id, columnaId })}
          onAbrir={(t) => setHoja({ tipo: 'tarea', id: t.id })}
          onAgregar={agregarRapido}
          onPersistirOrden={persistirOrden}
          onCrearColumna={crearColumna}
          onRenombrarColumna={renombrarColumna}
          onEliminarColumna={eliminarColumna}
          onColumnasBase={columnasBase}
        />
        {hojaActual}
      </>
    )
  }

  const pendientes = datos.enriquecidas.filter((t) => !t.hecha)
  const vencidas = pendientes.filter((t) => estadoFecha(t.fecha_limite) === 'vencida')
    .sort(porFechaYHora)
  const paraHoy = pendientes.filter((t) => estadoFecha(t.fecha_limite) === 'hoy').sort(porFechaYHora)
  const hechasHoy = datos.enriquecidas.filter((t) => t.hecha && t.fecha_limite === hoyISO())
  const totalHoy = paraHoy.length + hechasHoy.length
  const pctHoy = totalHoy ? Math.round((hechasHoy.length / totalHoy) * 100) : 0
  // Lo que viene: primero los próximos 3 días; si no hay nada, lo más cercano. Máximo 5 en el inicio
  const futuras = pendientes.filter((t) => t.fecha_limite && t.fecha_limite > hoyISO())
    .sort(porFechaYHora)
  const en3Dias = futuras.filter((t) => t.fecha_limite <= sumarDias(hoyISO(), 3))
  const hayEn3Dias = en3Dias.length > 0
  const proximas = (hayEn3Dias ? en3Dias : futuras).slice(0, MAX_PROXIMAS)
  const foco = [...vencidas, ...paraHoy]

  const resumenHoy = [
    totalHoy ? `${paraHoy.length} para hoy` : 'Nada con fecha de hoy',
    vencidas.length && `${vencidas.length} vencida${vencidas.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ')

  function filaTarea(t) {
    const puedeCompletar = !!columnaHechaDe(t)
    return (
      <li key={t.id} className="fila-tarea">
        {puedeCompletar ? (
          <button className="fila-tarea-check" onClick={() => completar(t)} aria-label={`Marcar "${t.titulo}" como hecha`}>
            <Circle size={20} strokeWidth={1.5} className="icono-vacio" />
            <CircleCheck size={20} strokeWidth={1.5} className="icono-lleno" />
          </button>
        ) : <span className="fila-tarea-punto" />}
        <button className="fila-tarea-texto" onClick={() => setHoja({ tipo: 'tarea', id: t.id })}>
          <span>{t.titulo}</span>
          <span className="texto-suave">
            {t.espacio.nombre}
            {t.fecha_limite && <> · <span className={`fecha-${estadoFecha(t.fecha_limite)}`}>{etiquetaFecha(t.fecha_limite)}{t.hora ? ` · ${formatoHora(t.hora)}` : ''}</span></>}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="tar">
      <header className="tar-header">
        <div>
          <h1 className="tar-titulo">Tareas</h1>
          <span className="texto-suave">{fechaLarga()}</span>
        </div>
        <div className="tar-header-acciones">
        <button className="icono-btn" onClick={() => setHoja({ tipo: 'notificaciones' })} aria-label="Notificaciones"><Bell size={18} /></button>
        <button className="icono-btn vino" onClick={() => setHoja({ tipo: 'nueva' })} aria-label="Nueva tarea" disabled={!espacios.length}>
          <Plus size={18} />
        </button>
        </div>
      </header>

      {espacios.length === 0 ? (
        <section className="tar-card tar-bienvenida">
          <h2>Empieza con un espacio</h2>
          <p className="texto-suave">Un espacio agrupa tus tareas: Trabajo, Personal, Apps… Cada uno trae su tablero con columnas.</p>
          <button className="boton-grande" onClick={() => setHoja({ tipo: 'espacio', espacio: null })}>Crear mi primer espacio</button>
        </section>
      ) : (
        <>
          <section className="tar-card">
            <div className="tar-hoy">
              <Anillo pct={pctHoy} texto={totalHoy ? `${hechasHoy.length}/${totalHoy}` : '–'} />
              <div>
                <span className="tar-card-titulo">Hoy</span>
                <span className={`texto-suave ${vencidas.length ? 'rojo' : ''}`}>{resumenHoy}</span>
              </div>
            </div>
            {foco.length > 0 ? (
              <ul className="lista-tareas">{foco.map((t) => filaTarea(t))}</ul>
            ) : (
              <p className="tar-tranquilo">{totalHoy ? 'Terminaste todo lo de hoy.' : 'Día despejado. Agrega algo con el +.'}</p>
            )}
          </section>

          {proximas.length > 0 && (
            <section className="tar-card">
              <span className="tar-etiqueta">{hayEn3Dias ? 'Próximos 3 días' : 'Lo que viene'}</span>
              {en3Dias.length > MAX_PROXIMAS && (
                <p className="alerta tar-alerta">
                  Tienes {en3Dias.length} tareas que vencen en los próximos 3 días. Aquí ves las {MAX_PROXIMAS} más urgentes.
                </p>
              )}
              <ul className="lista-tareas">{proximas.map((t) => filaTarea(t))}</ul>
            </section>
          )}

          <div className="tar-seccion-header">
            <span className="tar-etiqueta">Espacios</span>
            <button className="link-violeta" onClick={() => setHoja({ tipo: 'espacio', espacio: null })}><Plus size={14} /> Nuevo</button>
          </div>
          <div className="espacios-grid">
            {espacios.map((e) => {
              const propias = datos.enriquecidas.filter((t) => t.espacio.id === e.id)
              const hechas = propias.filter((t) => t.hecha).length
              const pend = propias.length - hechas
              const pct = propias.length ? Math.round((hechas / propias.length) * 100) : 0
              return (
                <div key={e.id} className="espacio-card">
                  <button className="espacio-card-cuerpo" onClick={() => abrirEspacio(e)}>
                    <div className="espacio-card-top">
                      <span className="espacio-nombre">{e.nombre}</span>
                      <ChevronRight size={16} className="texto-suave" />
                    </div>
                    <span className="texto-suave">
                      {propias.length === 0 ? 'Sin tareas' : `${pend} pendiente${pend === 1 ? '' : 's'} · ${hechas} hecha${hechas === 1 ? '' : 's'}`}
                    </span>
                    <div className="barra-progreso barra-mini">
                      <div className={`barra-relleno ${pct === 100 ? 'barra-completa' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                  <button className="espacio-card-editar" onClick={() => setHoja({ tipo: 'espacio', espacio: e })} aria-label={`Editar ${e.nombre}`}>
                    <Ellipsis size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {hojaActual}
    </div>
  )
}
