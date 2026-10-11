import { useEffect, useRef, useState } from 'react'
import { SendHorizontal, CalendarCheck, Undo2 } from 'lucide-react'
import { supabase } from './supabaseClient'
import { hoyISO } from './fechas'
import { etiquetaFecha, formatoHora } from './tareas/base'

const SALUDO = { rol: 'jarvis', texto: '¿Qué quieres saber?' }

// "sábado 11 de octubre de 2026, 3:40 p. m." para que Jarvis sepa tu día y hora reales
function ahoraLegible() {
  return new Date().toLocaleString('es-HN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Muestra **negritas** y viñetas que manda Jarvis
function formatear(texto) {
  return texto.split('\n').map((linea, i) => {
    const limpia = linea.replace(/^\s*[*-]\s+/, '• ')
    const trozos = limpia.split(/(\*\*[^*]+\*\*)/g).map((t, j) =>
      t.startsWith('**') && t.endsWith('**') ? <b key={j}>{t.slice(2, -2)}</b> : t
    )
    return <span key={i}>{trozos}{'\n'}</span>
  })
}

// La conversación vive solo mientras estás en esta pantalla: al salir, se borra (a propósito)
export default function Jarvis() {
  const [mensajes, setMensajes] = useState([SALUDO])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)
  const listaRef = useRef(null)

  // Siempre baja al último mensaje
  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [mensajes, cargando])

  // Si Jarvis entendió mal, borra las tareas que acaba de crear
  async function deshacer(indice) {
    const ids = mensajes[indice].creadas.map((t) => t.id)
    const { error } = await supabase.from('tarjetas').delete().in('id', ids)
    if (error) { alert(error.message); return }
    setMensajes((prev) => prev.map((m, i) => (i === indice ? { ...m, deshecho: true } : m)))
  }

  async function enviar(texto) {
    const preguntaActual = texto.trim()
    if (!preguntaActual || cargando) return

    const historial = mensajes.slice(1) // sin el saludo
    setMensajes((prev) => [...prev, { rol: 'user', texto: preguntaActual }])
    setPregunta('')
    setCargando(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: preguntaActual,
          accessToken: session.access_token,
          hoy: hoyISO(),
          ahora: ahoraLegible(),
          historial,
        }),
      })
      const data = await res.json()
      const respuesta = data.respuesta || data.error || 'Algo salió mal.'
      setMensajes((prev) => [...prev, { rol: 'jarvis', texto: respuesta, creadas: data.creadas || [] }])
    } catch {
      setMensajes((prev) => [...prev, { rol: 'jarvis', texto: 'No me pude conectar. Revisa tu internet e intenta de nuevo.' }])
    }
    setCargando(false)
  }

  return (
    <div className="seccion jarvis-chat">
      <div className="jarvis-mensajes" ref={listaRef}>
        {mensajes.map((m, i) => (
          <div key={i} className={`jarvis-burbuja ${m.rol}`}>
            {m.rol === 'jarvis' ? formatear(m.texto) : m.texto}
            {m.creadas?.length > 0 && (
              <div className={`jarvis-agenda ${m.deshecho ? 'deshecho' : ''}`}>
                {m.creadas.map((t) => (
                  <span key={t.id} className="jarvis-agenda-item">
                    <CalendarCheck size={14} />
                    <span>
                      {t.titulo}
                      <span className="texto-suave"> · {etiquetaFecha(t.fecha) || 'sin fecha'}{t.hora ? ` · ${formatoHora(t.hora)}` : ''} · {t.espacio}</span>
                    </span>
                  </span>
                ))}
                {m.deshecho
                  ? <span className="texto-suave">Deshecho: se borraron de Tareas.</span>
                  : <button className="link-violeta" onClick={() => deshacer(i)}><Undo2 size={14} /> Deshacer</button>}
              </div>
            )}
          </div>
        ))}
        {cargando && (
          <div className="jarvis-burbuja jarvis jarvis-escribiendo" aria-label="Jarvis está pensando">
            <span /><span /><span />
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(pregunta) }} className="jarvis-input-fila">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Pregúntale algo a Jarvis..."
          enterKeyHint="send"
        />
        <button type="submit" disabled={cargando || !pregunta.trim()} aria-label="Enviar">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  )
}
