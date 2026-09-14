import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Jarvis() {
  const [mensajes, setMensajes] = useState([
    { rol: 'jarvis', texto: '¿Qué quieres saber?' },
  ])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    if (!pregunta.trim() || cargando) return

    const preguntaActual = pregunta
    setMensajes((prev) => [...prev, { rol: 'user', texto: preguntaActual }])
    setPregunta('')
    setCargando(true)

    const { data: { session } } = await supabase.auth.getSession()

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: preguntaActual,
          accessToken: session.access_token,
        }),
      })
      const data = await res.json()
      const respuesta = data.respuesta || data.error || 'Algo salió mal.'
      setMensajes((prev) => [...prev, { rol: 'jarvis', texto: respuesta }])
    } catch (err) {
      setMensajes((prev) => [...prev, { rol: 'jarvis', texto: 'Error de conexión: ' + err.message }])
    }
    setCargando(false)
  }

  return (
    <div className="seccion jarvis-chat">
      <div className="jarvis-mensajes">
        {mensajes.map((m, i) => (
          <div key={i} className={`jarvis-burbuja ${m.rol}`}>
            {m.texto}
          </div>
        ))}
        {cargando && <div className="jarvis-burbuja jarvis">Pensando...</div>}
      </div>

      <form onSubmit={enviar} className="jarvis-input-fila">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Pregúntale algo a Jarvis..."
        />
        <button type="submit" disabled={cargando}>➤</button>
      </form>
    </div>
  )
}