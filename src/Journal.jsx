import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

const CAMPOS_VACIOS = {
  objetivo_dia: '', resumen: '', reflexion: '', aprendizaje: '',
}

export default function Journal() {
  const [fecha, setFecha] = useState(hoyISO())
  const [campos, setCampos] = useState(CAMPOS_VACIOS)
  const [entradaId, setEntradaId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [analizando, setAnalizando] = useState(false)
  const [analisis, setAnalisis] = useState(null)

  async function cargar(f) {
    setCargando(true)
    const { data } = await supabase
      .from('journal_entradas')
      .select('*')
      .eq('fecha', f)
      .maybeSingle()

    if (data) {
      setEntradaId(data.id)
      setCampos({
        objetivo_dia: data.objetivo_dia || '',
        resumen: data.resumen || '',
        reflexion: data.reflexion || '',
        aprendizaje: data.aprendizaje || '',
      })
      if (data.puntaje_ia) {
        setAnalisis({ puntaje: data.puntaje_ia, comentario: data.comentario_ia })
      } else {
        setAnalisis(null)
      }
    } else {
      setEntradaId(null)
      setCampos(CAMPOS_VACIOS)
      setAnalisis(null)
    }
    setCargando(false)
  }

  useEffect(() => { cargar(fecha) }, [fecha])

  async function guardar() {
    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('journal_entradas')
      .upsert(
        { id: entradaId ?? undefined, user_id: user.id, fecha, ...campos },
        { onConflict: 'user_id,fecha' }
      )
      .select()
      .single()

    setGuardando(false)
    if (error) { alert(error.message); return }
    setEntradaId(data.id)
  }

  async function pedirAnalisis() {
    if (!entradaId) { alert('Guarda tu entrada primero.'); return }
    setAnalizando(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/analizar-dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, accessToken: session.access_token }),
    })
    const data = await res.json()
    setAnalizando(false)
    if (data.error) { alert(data.error); return }
    setAnalisis(data)
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
          onChange={(e) => setFecha(e.target.value)}
        />
        <button onClick={() => setFecha(sumarDias(fecha, 1))} disabled={esHoy}>→</button>
      </div>

      {cargando ? (
        <p className="vacio">Cargando...</p>
      ) : (
        <>
          <div className="journal-campo">
            <label>Objetivo del día</label>
            <input
              value={campos.objetivo_dia}
              onChange={(e) => setCampos({ ...campos, objetivo_dia: e.target.value })}
              placeholder="¿Cuál es tu foco de hoy?"
            />
          </div>

          <div className="journal-campo">
            <label>Resumen</label>
            <textarea
              rows={4}
              value={campos.resumen}
              onChange={(e) => setCampos({ ...campos, resumen: e.target.value })}
              placeholder="¿Qué pasó hoy?"
            />
          </div>

          <div className="journal-campo">
            <label>Reflexión</label>
            <textarea
              rows={4}
              value={campos.reflexion}
              onChange={(e) => setCampos({ ...campos, reflexion: e.target.value })}
              placeholder="¿Cómo te sentiste? ¿Qué pensaste?"
            />
          </div>

          <div className="journal-campo">
            <label>Aprendizaje del día</label>
            <textarea
              rows={3}
              value={campos.aprendizaje}
              onChange={(e) => setCampos({ ...campos, aprendizaje: e.target.value })}
              placeholder="¿Qué te llevas de hoy?"
            />
          </div>

          {analisis ? (
            <div className="jarvis-analisis">
              <span className="jarvis-puntaje">{analisis.puntaje}/10</span>
              <span className="jarvis-comentario">{analisis.comentario}</span>
            </div>
          ) : (
            <button className="jarvis-placeholder" onClick={pedirAnalisis} disabled={analizando}>
              {analizando ? 'Jarvis está pensando...' : '🤖 Pedir análisis a Jarvis'}
            </button>
          )}

          <button className="boton-grande" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      )}
    </div>
  )
}