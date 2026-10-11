import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Settings, Plus, List, Lock, EllipsisVertical, RotateCw, X } from 'lucide-react'
import { supabase } from './supabaseClient'
import { hoyISO } from './fechas'
import { otorgarXP, quitarXP } from './xp'
import { revisarBonoFinanzas } from './gamificacion/bonoFinanzas'
import { ejecutar } from './offline/cola'
import {
  CATEGORIAS_BASE, CONFIG_BASE, GRUPOS_GASTO,
  mesDe, nombreMes, sumarMeses, rangoDelMes, lempiras, numero, pagosHechos,
} from './finanzas/base'
import Anillo from './ui/Anillo'
import HojaAgregar from './finanzas/HojaAgregar'
import PopupMetas from './finanzas/PopupMetas'
import Movimientos from './finanzas/Movimientos'
import MiPresupuesto from './finanzas/MiPresupuesto'
import './finanzas/finanzas.css'

// Precarga el presupuesto una sola vez (evita duplicados si el efecto corre dos veces)
let sembrando = null
function asegurarPresupuesto(userId) {
  if (!sembrando) {
    sembrando = (async () => {
      const { count, error } = await supabase
        .from('presupuesto_categorias').select('id', { count: 'exact', head: true })
      if (error) throw error
      if (!count) {
        const { error: e1 } = await supabase.from('presupuesto_categorias')
          .insert(CATEGORIAS_BASE.map((c, i) => ({ ...c, orden: i, user_id: userId })))
        if (e1) throw e1
      }
      const { data } = await supabase.from('presupuesto_config').select('user_id').maybeSingle()
      if (!data) await supabase.from('presupuesto_config').insert({ ...CONFIG_BASE, user_id: userId })
    })().catch((err) => { sembrando = null; throw err })
  }
  return sembrando
}

async function traerDatos(mes) {
  try {
    // Sesión guardada (no la red) y sin precarga si no hay internet: así abre offline con la última copia
    const { data: { session } } = await supabase.auth.getSession()
    if (navigator.onLine) await asegurarPresupuesto(session.user.id)
    const { desde, hasta } = rangoDelMes(mes)
    const [cats, conf, trs, mts, ana, primero] = await Promise.all([
      supabase.from('presupuesto_categorias').select('*').order('orden'),
      supabase.from('presupuesto_config').select('*').maybeSingle(),
      supabase.from('transacciones').select('*').gte('fecha', desde).lte('fecha', hasta)
        .order('fecha', { ascending: false }).order('creado_en', { ascending: false }),
      supabase.from('metas_financieras').select('*').order('creado_en'),
      supabase.from('analisis_financiero').select('*').eq('mes', mes)
        .order('fecha', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('transacciones').select('fecha').order('fecha').limit(1).maybeSingle(),
    ])
    const fallo = [cats, trs, mts].find((r) => r.error)
    if (fallo) throw fallo.error
    return {
      cats: cats.data || [], conf: conf.data, trs: trs.data || [], mts: mts.data || [], ultimo: ana.data,
      primerMes: primero.data ? mesDe(primero.data.fecha) : null,
    }
  } catch (err) {
    return { error: err.message || 'No se pudo cargar Finanzas' }
  }
}

const suma = (lista, fn) => lista.reduce((s, x) => s + (Number(fn(x)) || 0), 0)

export default function Finanzas({ agregarAlAbrir = null }) {
  const mesActual = mesDe(hoyISO())
  const [mes, setMes] = useState(mesActual)
  const [categorias, setCategorias] = useState([])
  const [config, setConfig] = useState(CONFIG_BASE)
  const [transacciones, setTransacciones] = useState([])
  const [metas, setMetas] = useState([])
  const [primerMes, setPrimerMes] = useState(null) // mes del primer movimiento registrado
  const [analisis, setAnalisis] = useState(null)
  const [jarvis, setJarvis] = useState('cargando') // cargando | listo | error | sin-datos | sin-analisis
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  // Si se abrió con el enlace directo, la ventanita de agregar ya viene abierta
  const [abierto, setAbierto] = useState(agregarAlAbrir ? 'agregar' : null) // agregar | metas | movs | presu
  const [tipoAgregar, setTipoAgregar] = useState(agregarAlAbrir || 'gasto')
  const [expandido, setExpandido] = useState({})
  const [slide, setSlide] = useState(0)
  const [avisoBono, setAvisoBono] = useState(null)
  const [avisoOffline, setAvisoOffline] = useState('')

  // Al abrir: si el mes pasado cumpliste tus reglas, se cobra el bono (+300 XP) una sola vez
  useEffect(() => {
    let vigente = true
    revisarBonoFinanzas().then((r) => { if (vigente && r) setAvisoBono(r) }).catch(() => {})
    return () => { vigente = false }
  }, [])

  const carruselRef = useRef(null)
  const slidesRef = useRef([])
  const arrastre = useRef(null)
  const jarvisPedido = useRef({})

  const pedirJarvis = useCallback(async (mesPedido) => {
    setJarvis('cargando')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/analizar-finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: mesPedido, fecha: hoyISO(), accessToken: session.access_token }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setAnalisis(data)
      setJarvis('listo')
    } catch {
      setJarvis('error')
    }
  }, [])

  const aplicar = useCallback((mesCargar, r) => {
    setCargando(false)
    if (r.error) { setErrorCarga(r.error); return }
    const { cats, conf, trs, mts, ultimo, primerMes: primer } = r
    setCategorias(cats)
    if (conf) setConfig(conf)
    setTransacciones(trs)
    setMetas(mts)
    setPrimerMes(primer)
    setErrorCarga('')

    const esMesActual = mesCargar === mesDe(hoyISO())
    if (ultimo && (!esMesActual || ultimo.fecha === hoyISO())) {
      setAnalisis(ultimo); setJarvis('listo')
    } else if (!esMesActual) {
      setAnalisis(null); setJarvis('sin-analisis')
    } else if (trs.length === 0) {
      setAnalisis(null); setJarvis('sin-datos')
    } else if (!jarvisPedido.current[mesCargar]) {
      // Una vez al día: la primera vez que se abre Finanzas con datos
      jarvisPedido.current[mesCargar] = true
      if (ultimo) setAnalisis(ultimo)
      pedirJarvis(mesCargar)
    }
  }, [pedirJarvis])

  const cargar = useCallback(
    (mesCargar) => traerDatos(mesCargar).then((r) => aplicar(mesCargar, r)),
    [aplicar]
  )

  useEffect(() => {
    // Si cambias de mes rápido, se ignora la respuesta del mes anterior
    let vigente = true
    traerDatos(mes).then((r) => { if (vigente) aplicar(mes, r) })
    return () => { vigente = false }
  }, [mes, aplicar])

  // ---------- Cálculos del mes ----------
  const activas = useMemo(() => categorias.filter((c) => c.activa !== false), [categorias])
  const catPorId = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias])

  const resumen = useMemo(() => {
    const grupoDe = (t) => catPorId[t.categoria_id]?.grupo || t.categoria
    const gastosTr = transacciones.filter((t) => t.tipo === 'gasto')
    // Solo cuenta el dinero que de verdad registraste: sin ingresos, todo arranca en 0
    const ingresos = suma(transacciones.filter((t) => t.tipo === 'ingreso'), (t) => t.monto)

    const grupos = GRUPOS_GASTO.map((g) => {
      const cats = activas.filter((c) => c.grupo === g)
      const trsGrupo = gastosTr.filter((t) => grupoDe(t) === g)
      const planeado = suma(cats, (c) => c.monto_planeado)
      const gastado = suma(trsGrupo, (t) => t.monto)
      const subs = cats.map((c) => ({
        ...c, gastado: suma(trsGrupo.filter((t) => t.categoria_id === c.id), (t) => t.monto),
      }))
      return { grupo: g, planeado, gastado, pct: planeado ? Math.round((gastado / planeado) * 100) : 0, subs }
    }).filter((g) => g.planeado > 0 || g.gastado > 0)

    const ahorro = grupos.find((g) => g.grupo === 'Ahorro') || { planeado: 0, gastado: 0 }
    const gastos = suma(grupos.filter((g) => g.grupo !== 'Ahorro'), (g) => g.gastado)
    // El ahorro se aparta apenas entra dinero, pero nunca más de lo que entró
    const protegido = ingresos > 0
      ? Math.min(ingresos, Math.max(ahorro.planeado, ahorro.gastado))
      : ahorro.gastado

    return {
      ingresos, gastos, grupos, protegido,
      saldo: ingresos - gastos,
      teQuedan: ingresos - protegido - gastos,
    }
  }, [transacciones, activas, catPorId])

  function alertaDe(g) {
    const base = resumen.ingresos
    if (g.grupo === 'Ahorro') {
      const pctIngreso = base ? (g.gastado / base) * 100 : 0
      if (base && mes < mesActual && pctIngreso < Number(config.ahorro_minimo_pct)) {
        return { texto: `Ahorraste ${Math.round(pctIngreso)}%, debajo de tu mínimo de ${numero(config.ahorro_minimo_pct)}%`, nivel: 'alto' }
      }
      if (base && g.gastado < g.planeado) return { texto: `Faltan ${lempiras(g.planeado - g.gastado)} por abonar`, nivel: 'info' }
      return null
    }
    if (g.grupo === 'Entretenimiento' && base && (g.gastado / base) * 100 > Number(config.entretenimiento_max_pct)) {
      return { texto: `Pasaste tu límite del ${numero(config.entretenimiento_max_pct)}% del ingreso`, nivel: 'alto' }
    }
    if (g.pct > 100) return { texto: `Te pasaste por ${lempiras(g.gastado - g.planeado)}`, nivel: 'alto' }
    if (g.pct >= 85) return { texto: 'Cerca del límite', nivel: 'medio' }
    return null
  }

  const metasNormales = metas.filter((m) => m.tipo !== 'deuda')
  const deudas = metas.filter((m) => m.tipo === 'deuda' && !m.completada)
  const pctMetas = (() => {
    const objetivo = suma(metasNormales, (m) => m.valor_objetivo)
    return objetivo ? Math.round((suma(metasNormales, (m) => m.valor_actual) / objetivo) * 100) : 0
  })()

  // ---------- Carrusel: altura según la vista activa ----------
  useLayoutEffect(() => {
    const el = carruselRef.current
    const actual = slidesRef.current[slide]
    if (!el || !actual) return
    const ajustar = () => { el.style.height = `${actual.offsetHeight}px` }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(actual)
    return () => obs.disconnect()
  }, [slide, cargando])

  function alDeslizar() {
    const el = carruselRef.current
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== slide) setSlide(i)
  }

  function irASlide(i) {
    const el = carruselRef.current
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  // Arrastrar con el mouse en la compu
  function alPresionar(e) {
    if (e.pointerType !== 'mouse') return
    arrastre.current = { x: e.clientX, scroll: carruselRef.current.scrollLeft, movio: false }
  }
  function alMover(e) {
    const a = arrastre.current
    if (!a) return
    const dx = e.clientX - a.x
    if (Math.abs(dx) > 5) {
      a.movio = true
      const el = carruselRef.current
      el.style.scrollSnapType = 'none'
      el.scrollLeft = a.scroll - dx
    }
  }
  function alSoltar(e) {
    const a = arrastre.current
    if (!a) return
    const el = carruselRef.current
    el.style.scrollSnapType = ''
    if (a.movio) {
      const dx = e.clientX - a.x
      const destino = Math.abs(dx) > el.clientWidth * 0.15 ? (dx < 0 ? 1 : 0) : slide
      irASlide(destino)
      setTimeout(() => { arrastre.current = null }, 0)
    } else {
      arrastre.current = null
    }
  }
  function abrirAgregarDesdeSlide() {
    if (arrastre.current?.movio) return
    setAbierto('agregar')
  }

  // ---------- Acciones ----------
  // Se lee de la sesión guardada (no de la red) para que funcione sin internet
  async function usuarioId() {
    const { data: { session } } = await supabase.auth.getSession()
    return session.user.id
  }

  // Registra un movimiento ligado a una meta (abono o cuota) y actualiza su progreso
  async function registrarConMeta(meta, fila) {
    const { error } = await supabase.from('transacciones').insert({ ...fila, meta_id: meta.id })
    if (error) { alert(error.message); return false }
    const valor = Number(meta.valor_actual) + Number(fila.monto)
    const completada = valor >= Number(meta.valor_objetivo)
    await supabase.from('metas_financieras').update({ valor_actual: valor, completada }).eq('id', meta.id)
    await otorgarXP('meta_actualizada')
    if (completada && !meta.completada) await otorgarXP('meta_completada')
    return true
  }

  async function guardarMovimiento({ tipo, monto, categoria, fecha, nota }) {
    const fila = {
      tipo, monto, fecha, descripcion: nota, user_id: await usuarioId(),
      categoria: categoria.grupo, subcategoria: categoria.nombre, categoria_id: categoria.id,
    }
    // Si pagas una deuda desde la ventanita, también avanza su contador
    const deuda = categoria.grupo === 'Deuda' && metas.find((m) =>
      m.tipo === 'deuda' && !m.completada && m.nombre.trim().toLowerCase() === categoria.nombre.trim().toLowerCase())
    if (deuda) {
      const ok = await registrarConMeta(deuda, fila)
      if (ok) { await otorgarXP('movimiento'); await cargar(mes) }
      return ok
    }
    // Gasto o ingreso normal: funciona sin internet y no se duplica aunque se envíe dos veces
    const r = await ejecutar({
      tabla: 'transacciones', accion: 'insert', datos: { id: crypto.randomUUID(), ...fila },
      xp: { otorgar: ['movimiento'] },
    })
    if (!r.ok) { alert(r.error); return false }
    if (r.pendiente) setAvisoOffline('Guardado en el teléfono: se enviará cuando vuelva el internet.')
    else await cargar(mes)
    return true
  }

  async function abonar(meta, monto) {
    const cat = activas.find((c) => c.grupo === 'Ahorro')
    const ok = await registrarConMeta(meta, {
      tipo: 'gasto', monto, fecha: hoyISO(), user_id: await usuarioId(),
      categoria: 'Ahorro', subcategoria: cat?.nombre || 'Ahorro', categoria_id: cat?.id || null,
      descripcion: `Abono a ${meta.nombre}`,
    })
    if (ok) { await otorgarXP('movimiento'); await cargar(mes) }
    return ok
  }

  async function pagarCuota(deuda) {
    const cat = activas.find((c) => c.grupo === 'Deuda' && c.nombre.trim().toLowerCase() === deuda.nombre.trim().toLowerCase())
      || activas.find((c) => c.grupo === 'Deuda')
    const ok = await registrarConMeta(deuda, {
      tipo: 'gasto', monto: Number(deuda.cuota_mensual), fecha: hoyISO(), user_id: await usuarioId(),
      categoria: 'Deuda', subcategoria: cat?.nombre || deuda.nombre, categoria_id: cat?.id || null,
      descripcion: `Cuota ${pagosHechos(deuda) + 1} de ${deuda.total_pagos}`,
    })
    if (ok) { await otorgarXP('movimiento'); await cargar(mes) }
    return ok
  }

  async function eliminarMovimiento(t) {
    const { error } = await supabase.from('transacciones').delete().eq('id', t.id)
    if (error) { alert(error.message); return }
    await quitarXP('movimiento')
    const meta = t.meta_id && metas.find((m) => m.id === t.meta_id)
    if (meta) {
      const valor = Math.max(0, Number(meta.valor_actual) - Number(t.monto))
      await supabase.from('metas_financieras')
        .update({ valor_actual: valor, completada: valor >= Number(meta.valor_objetivo) }).eq('id', meta.id)
    }
    await cargar(mes)
  }

  async function guardarMeta(datos, editando) {
    let error
    if (editando) {
      const completada = Number(editando.valor_actual) >= Number(datos.valor_objetivo)
      ;({ error } = await supabase.from('metas_financieras').update({ ...datos, completada }).eq('id', editando.id))
    } else {
      ;({ error } = await supabase.from('metas_financieras')
        .insert({ valor_actual: 0, completada: false, ...datos, user_id: await usuarioId() }))
    }
    if (error) { alert(error.message); return false }
    await cargar(mes)
    return true
  }

  async function eliminarMeta(meta) {
    const { error } = await supabase.from('metas_financieras').delete().eq('id', meta.id)
    if (error) { alert(error.message); return }
    await cargar(mes)
  }

  async function guardarPresupuesto({ filas, eliminadas, conf }) {
    const userId = await usuarioId()
    const operaciones = []
    if (eliminadas.length) {
      operaciones.push(supabase.from('presupuesto_categorias').update({ activa: false }).in('id', eliminadas))
    }
    filas.forEach((f, i) => {
      const datos = { nombre: f.nombre.trim(), icono: f.icono, monto_planeado: Number(f.monto_planeado) || 0, orden: i }
      if (String(f.id).startsWith('nueva-')) {
        operaciones.push(supabase.from('presupuesto_categorias').insert({ ...datos, tipo: f.tipo, grupo: f.grupo, user_id: userId }))
      } else {
        const original = catPorId[f.id]
        const cambio = original && (original.nombre !== datos.nombre || Number(original.monto_planeado) !== datos.monto_planeado || original.orden !== i)
        if (cambio) operaciones.push(supabase.from('presupuesto_categorias').update(datos).eq('id', f.id))
      }
    })
    operaciones.push(supabase.from('presupuesto_config').upsert({
      user_id: userId,
      ingreso_referencia: Number(conf.ingreso_referencia) || 0,
      ahorro_minimo_pct: Number(conf.ahorro_minimo_pct) || 0,
      entretenimiento_max_pct: Number(conf.entretenimiento_max_pct) || 0,
      actualizado_en: new Date().toISOString(),
    }))
    const resultados = await Promise.all(operaciones)
    const fallo = resultados.find((r) => r.error)
    if (fallo) { alert(fallo.error.message); return false }
    await cargar(mes)
    return true
  }

  // ---------- Render ----------
  if (cargando) return <p className="vacio">Cargando...</p>
  if (errorCarga) {
    return (
      <div className="fin">
        <div className="fin-card">
          <p className="alerta">No se pudo cargar Finanzas: {errorCarga}</p>
          <p className="texto-suave">Revisa que el SQL de Supabase se haya corrido completo.</p>
        </div>
      </div>
    )
  }

  const deuda = deudas[0]
  const nActivas = metasNormales.filter((m) => !m.completada).length
  const subtituloMetas = [
    metasNormales.length > 0 && (nActivas === 1 ? '1 meta activa' : `${nActivas} metas activas`),
    deuda && `${deuda.nombre} pago ${pagosHechos(deuda)} de ${deuda.total_pagos}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="fin">
      {avisoBono && (
        <div className="aviso-juego" role="status">
          <div>
            <span>💸 <b>¡Cerraste {nombreMes(avisoBono.mes)} cumpliendo tus reglas!</b> +300 XP</span>
            <span className="texto-suave">Ahorro {avisoBono.ahorroPct}% · Entretenimiento {avisoBono.entretenimientoPct}%</span>
          </div>
          <button onClick={() => setAvisoBono(null)} aria-label="Cerrar aviso"><X size={16} /></button>
        </div>
      )}

      {avisoOffline && (
        <div className="aviso-juego" role="status">
          <div><span>📴 {avisoOffline}</span></div>
          <button onClick={() => setAvisoOffline('')} aria-label="Cerrar aviso"><X size={16} /></button>
        </div>
      )}

      <header className="fin-header">
        <div className="fin-mes">
          <button onClick={() => setMes(sumarMeses(mes, -1))} disabled={mes <= (primerMes || mesActual)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <span>{nombreMes(mes)}</span>
          <button onClick={() => setMes(sumarMeses(mes, 1))} disabled={mes >= mesActual} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
        </div>
        <div className="fin-header-acciones">
          <button className="icono-btn" onClick={() => setAbierto('presu')} aria-label="Mi presupuesto"><Settings size={18} /></button>
          <button className="icono-btn vino" onClick={() => setAbierto('agregar')} aria-label="Agregar movimiento"><Plus size={18} /></button>
        </div>
      </header>

      <section className="fin-card">
        <span className="fin-etiqueta">Global</span>
        <div className="fin-fila">
          <span>Saldo del mes</span>
          <span className={`fin-grande ${resumen.saldo < 0 ? 'rojo' : ''}`}>{lempiras(resumen.saldo)}</span>
        </div>
        <div className="fin-fila fin-fila-sec">
          <span>Te quedan para tus gastos</span>
          <span className={`fin-mediano ${resumen.teQuedan < 0 ? 'rojo' : ''}`}>{lempiras(resumen.teQuedan)}</span>
        </div>
        <div className="fin-pie">
          <button className="fin-link" onClick={() => setAbierto('movs')}>
            <List size={15} /> Movimientos <b>{transacciones.length}</b>
          </button>
          {resumen.protegido > 0 && (
            <span className="fin-protegido">Ahorro protegido {lempiras(resumen.protegido)} <Lock size={13} /></span>
          )}
        </div>
      </section>

      <section className="fin-card">
        <span className="fin-etiqueta">{slide === 0 ? 'Gastos e ingresos' : 'Tu presupuesto'}</span>
        <div
          className="carrusel"
          ref={carruselRef}
          onScroll={alDeslizar}
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerLeave={alSoltar}
        >
          <div className="slide" ref={(el) => { slidesRef.current[0] = el }}>
            <button className="fin-totales" onClick={abrirAgregarDesdeSlide}>
              <div>
                <span className="fin-grande">{numero(resumen.ingresos)}</span>
                <span className="verde">Ingresos</span>
              </div>
              <div>
                <span className="fin-grande">{numero(resumen.gastos)}</span>
                <span className="rojo">Gastos</span>
              </div>
            </button>
          </div>

          <div className="slide" ref={(el) => { slidesRef.current[1] = el }}>
            <div className="presu-barras">
              {resumen.grupos.map((g) => {
                const alerta = alertaDe(g)
                const abiertoG = expandido[g.grupo]
                return (
                  <div key={g.grupo} className="presu-barra">
                    <div className="presu-barra-fila">
                      <span className="presu-barra-nombre">{g.grupo}</span>
                      <div className="barra-progreso">
                        <div
                          className={`barra-relleno ${g.grupo === 'Ahorro' ? 'barra-completa' : ''} ${g.pct > 100 && g.grupo !== 'Ahorro' ? 'barra-pasada' : ''}`}
                          style={{ width: `${Math.min(100, g.pct)}%` }}
                        />
                      </div>
                      <span className={`presu-barra-pct ${alerta?.nivel === 'alto' ? 'rojo' : ''}`}>{g.pct}%</span>
                      <button
                        className="presu-mas"
                        onClick={() => setExpandido({ ...expandido, [g.grupo]: !abiertoG })}
                        aria-label={`Ver subcategorías de ${g.grupo}`}
                        aria-expanded={!!abiertoG}
                      >
                        <EllipsisVertical size={16} />
                      </button>
                    </div>
                    {alerta && <span className={`presu-alerta ${alerta.nivel}`}>{alerta.texto}</span>}
                    {abiertoG && (
                      <div className="presu-subs">
                        {g.subs.map((s) => (
                          <div key={s.id} className={s.gastado > s.monto_planeado && g.grupo !== 'Ahorro' ? 'rojo' : ''}>
                            <span>{s.nombre}</span>
                            <span>{numero(s.gastado)} / {numero(s.monto_planeado)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="puntos">
          {[0, 1].map((i) => (
            <button key={i} className={slide === i ? 'activo' : ''} onClick={() => irASlide(i)}
              aria-label={i === 0 ? 'Ver gastos e ingresos' : 'Ver presupuesto'} />
          ))}
        </div>
      </section>

      <button className="fin-card fin-panel" onClick={() => setAbierto('metas')}>
        <Anillo pct={pctMetas} texto={`${pctMetas}%`} />
        <div className="fin-panel-texto">
          <div className="fin-fila"><span className="fin-panel-titulo">Metas</span><ChevronRight size={18} className="texto-suave" /></div>
          <span className="texto-suave">{subtituloMetas || 'Crea tu primera meta'}</span>
        </div>
      </button>

      <section className="fin-card fin-panel">
        <Anillo
          pct={analisis?.puntaje || 0}
          texto={jarvis === 'listo' || analisis ? String(analisis?.puntaje ?? '–') : '–'}
          color="var(--lagoon)"
        />
        <div className="fin-panel-texto">
          <div className="fin-fila">
            <span className="fin-panel-titulo">Score <span className="firma">Jarvis</span></span>
            {mes === mesActual && jarvis !== 'sin-datos' && (
              <button className="fin-refrescar" onClick={() => pedirJarvis(mes)} disabled={jarvis === 'cargando'} aria-label="Pedir un nuevo análisis">
                <RotateCw size={15} className={jarvis === 'cargando' ? 'girando' : ''} />
              </button>
            )}
          </div>
          <span className="texto-suave">
            {jarvis === 'cargando' && 'Jarvis está revisando tus finanzas…'}
            {jarvis === 'listo' && analisis?.comentario}
            {jarvis === 'error' && (analisis?.comentario || 'Jarvis no está disponible ahora. Intenta con ↻ más tarde.')}
            {jarvis === 'sin-datos' && 'Registra tus primeros movimientos del mes y Jarvis te dará su score.'}
            {jarvis === 'sin-analisis' && 'No hubo análisis de Jarvis este mes.'}
          </span>
        </div>
      </section>

      {abierto === 'agregar' && (
        <HojaAgregar categorias={activas} tipoInicial={tipoAgregar} onGuardar={guardarMovimiento} onCerrar={() => { setAbierto(null); setTipoAgregar('gasto') }} />
      )}
      {abierto === 'metas' && (
        <PopupMetas
          metas={metas}
          onGuardarMeta={guardarMeta}
          onEliminarMeta={eliminarMeta}
          onAbonar={abonar}
          onPagarCuota={pagarCuota}
          onCerrar={() => setAbierto(null)}
        />
      )}
      {abierto === 'movs' && (
        <Movimientos mes={mes} transacciones={transacciones} categorias={categorias}
          onEliminar={eliminarMovimiento} onCerrar={() => setAbierto(null)} />
      )}
      {abierto === 'presu' && (
        <MiPresupuesto categorias={activas} config={config} onGuardar={guardarPresupuesto} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  )
}
