import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { hoyISO, sumarDias } from './fechas'

async function obtenerToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session.access_token
}

function Lectura({ etiqueta, cita, texto, destacada }) {
  if (!texto) return null
  return (
    <div className={`palabra-lectura ${destacada ? 'palabra-evangelio' : ''}`}>
      <span className="palabra-etiqueta">{etiqueta}</span>
      <span className="palabra-cita">{cita}</span>
      <p className="palabra-texto">{texto}</p>
    </div>
  )
}

export default function Palabra() {
  const [fecha, setFecha] = useState(hoyISO())
  const [lecturas, setLecturas] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [reflexion, setReflexion] = useState('')
  const [oracion, setOracion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError('')
      setLecturas(null)
      try {
        const token = await obtenerToken()
        const [resp, entrada] = await Promise.all([
          fetch('/api/lecturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, accessToken: token }),
          }),
          supabase.from('palabra_entradas').select('*').eq('fecha', fecha).maybeSingle(),
        ])
        const datos = await resp.json().catch(() => ({}))
        if (cancelado) return

        if (resp.ok) setLecturas(datos)
        else setError(datos.error || 'No pude cargar las lecturas de este día')

        setReflexion(entrada.data?.reflexion || '')
        setOracion(entrada.data?.oracion_ia || '')
      } catch (e) {
        if (!cancelado) setError(e.message)
      }
      if (!cancelado) setCargando(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [fecha])

  async function guardar() {
    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('palabra_entradas')
      .upsert({ user_id: user.id, fecha, reflexion }, { onConflict: 'user_id,fecha' })
    setGuardando(false)
    if (error) { alert(error.message); return false }
    return true
  }

  async function pedirOracion() {
    // primero guarda tu reflexión, para que Jarvis la tome en cuenta
    if (!(await guardar())) return
    setGenerando(true)
    try {
      const token = await obtenerToken()
      const r = await fetch('/api/oracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, accessToken: token }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) alert(d.error || 'No se pudo generar la oración')
      else setOracion(d.oracion)
    } catch (e) {
      alert(e.message)
    }
    setGenerando(false)
  }

  const esHoy = fecha === hoyISO()

  return (
    <div className="seccion">
      <div className="journal-nav">
        <button onClick={() => setFecha(sumarDias(fecha, -1))}>←</button>
        <input
          type="date"
          className="journal-fecha-input"
          value={fecha}
          max={hoyISO()}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
        />
        <button onClick={() => setFecha(sumarDias(fecha, 1))} disabled={esHoy}>→</button>
      </div>

      {cargando && <p className="vacio">Cargando las lecturas...</p>}
      {!cargando && error && <p className="vacio">{error}</p>}

      {!cargando && lecturas && (
        <>
          {lecturas.titulo_liturgico && <h2 className="palabra-titulo">{lecturas.titulo_liturgico}</h2>}
          <Lectura etiqueta="Primera lectura" cita={lecturas.primera_cita} texto={lecturas.primera_texto} />
          <Lectura etiqueta="Salmo responsorial" cita={lecturas.salmo_cita} texto={lecturas.salmo_texto} />
          <Lectura etiqueta="Segunda lectura" cita={lecturas.segunda_cita} texto={lecturas.segunda_texto} />
          <Lectura etiqueta="Evangelio" cita={lecturas.evangelio_cita} texto={lecturas.evangelio_texto} destacada />
        </>
      )}

      {!cargando && (
        <>
          <div className="journal-campo">
            <label>Mi reflexión</label>
            <textarea
              rows={5}
              value={reflexion}
              onChange={(e) => setReflexion(e.target.value)}
              placeholder="¿Qué te dice la Palabra hoy?"
            />
          </div>

          <button className="boton-grande" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>

          {oracion && (
            <div className="oracion-card">
              <span className="palabra-etiqueta">Oración</span>
              <p className="palabra-texto">{oracion}</p>
            </div>
          )}

          <button
            className="jarvis-placeholder"
            onClick={pedirOracion}
            disabled={generando || !lecturas}
          >
            {generando
              ? 'Jarvis está escribiendo...'
              : oracion ? 'Pedir otra oración a Jarvis' : 'Pedir una oración a Jarvis'}
          </button>
        </>
      )}
    </div>
  )
}