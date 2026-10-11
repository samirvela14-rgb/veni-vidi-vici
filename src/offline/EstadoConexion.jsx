import { useEffect, useState } from 'react'
import { WifiOff, CloudUpload, Check } from 'lucide-react'
import { iniciarSincronizacion, pendientesEnCola } from './cola'

// Franja pequeña arriba: sin internet / cambios pendientes / "sincronizado".
// Al terminar de sincronizar avisa a la app para recargar la pantalla con datos frescos.
export default function EstadoConexion({ onSincronizado }) {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    const alCambiarRed = () => setEnLinea(navigator.onLine)
    const alCambiarCola = (e) => {
      setPendientes(e.detail.pendientes)
      const { enviados = 0, fallidos = [] } = e.detail
      if (enviados || fallidos.length) {
        setAviso(fallidos.length
          ? { error: true, texto: `${fallidos.length} cambio(s) no se pudieron guardar: ${fallidos[0]}` }
          : { texto: `${enviados} cambio${enviados === 1 ? '' : 's'} sincronizado${enviados === 1 ? '' : 's'}` })
        if (enviados) onSincronizado?.()
      }
    }
    window.addEventListener('online', alCambiarRed)
    window.addEventListener('offline', alCambiarRed)
    window.addEventListener('vvv-cola', alCambiarCola)
    pendientesEnCola().then(setPendientes)
    iniciarSincronizacion()
    return () => {
      window.removeEventListener('online', alCambiarRed)
      window.removeEventListener('offline', alCambiarRed)
      window.removeEventListener('vvv-cola', alCambiarCola)
    }
  }, [onSincronizado])

  // El aviso de "sincronizado" se va solo
  useEffect(() => {
    if (!aviso || aviso.error) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  if (!enLinea) {
    return (
      <div className="estado-conexion offline" role="status">
        <WifiOff size={15} />
        Sin internet{pendientes ? ` · ${pendientes} cambio${pendientes === 1 ? '' : 's'} guardado${pendientes === 1 ? '' : 's'} en el teléfono` : ' · lo que registres se guarda y se envía después'}
      </div>
    )
  }
  if (pendientes) {
    return <div className="estado-conexion" role="status"><CloudUpload size={15} /> Enviando {pendientes} cambio{pendientes === 1 ? '' : 's'}…</div>
  }
  if (aviso) {
    return (
      <div className={`estado-conexion ${aviso.error ? 'error' : 'listo'}`} role="status" onClick={() => setAviso(null)}>
        {!aviso.error && <Check size={15} />} {aviso.texto}
      </div>
    )
  }
  return null
}
