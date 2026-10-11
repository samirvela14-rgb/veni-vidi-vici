import { useEffect, useState } from 'react'
import { BellRing, BellOff } from 'lucide-react'
import Hoja from '../ui/Hoja'
import {
  estadoNotificaciones, activarNotificaciones, desactivarNotificaciones, probarNotificacion,
} from './notificaciones'

const instalada = () => window.matchMedia('(display-mode: standalone)').matches

export default function HojaNotificaciones({ onCerrar }) {
  const [estado, setEstado] = useState('cargando')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let vigente = true
    estadoNotificaciones().then((e) => { if (vigente) setEstado(e) })
    return () => { vigente = false }
  }, [])

  async function accion(fn, exito) {
    setOcupado(true)
    setMensaje('')
    try {
      await fn()
      setMensaje(exito)
      setEstado(await estadoNotificaciones())
    } catch (e) {
      setMensaje(e.message)
    }
    setOcupado(false)
  }

  return (
    <Hoja titulo="Notificaciones" onCerrar={onCerrar}>
      <div className="form-hoja notif">
        <ul className="notif-lista">
          <li><span>☀️</span> A las <b>7:00 am</b>: tus tareas del día con su hora y cuánto te queda para gastar.</li>
          <li><span>⏰</span> <b>15 a 30 min antes</b> de cada tarea con hora.</li>
        </ul>

        {estado === 'no-soportado' && (
          <p className="alerta">Este navegador no permite notificaciones. Usa Chrome y, en el teléfono, instala la app.</p>
        )}
        {estado === 'bloqueado' && (
          <p className="alerta">Bloqueaste las notificaciones. Actívalas en los ajustes del navegador o de la app (Permisos → Notificaciones).</p>
        )}

        {estado === 'activo' && (
          <>
            <p className="notif-estado activo"><BellRing size={16} /> Activas en este dispositivo</p>
            <button className="boton-grande" disabled={ocupado}
              onClick={() => accion(probarNotificacion, 'Te mandé una de prueba.')}>Probar notificación</button>
            <button className="boton-secundario" disabled={ocupado}
              onClick={() => accion(desactivarNotificaciones, 'Listo, ya no te llegarán aquí.')}>Desactivar en este dispositivo</button>
          </>
        )}
        {estado === 'inactivo' && (
          <>
            <p className="notif-estado"><BellOff size={16} /> Apagadas en este dispositivo</p>
            <button className="boton-grande" disabled={ocupado}
              onClick={() => accion(activarNotificaciones, '¡Activadas! Prueba con el botón de abajo.')}>Activar notificaciones</button>
          </>
        )}

        {mensaje && <p className="texto-suave centrado">{mensaje}</p>}

        {!instalada() && (
          <p className="texto-suave notif-pista">
            En Android: abre el menú de Chrome (⋮) → <b>Instalar app</b>. Así llegan aunque Chrome esté cerrado y la app queda en tu pantalla de inicio.
            Cada dispositivo (teléfono, PC) se activa por separado.
          </p>
        )}
      </div>
    </Hoja>
  )
}
