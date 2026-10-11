import { useEffect } from 'react'
import { X } from 'lucide-react'

// Ventanita: sube desde abajo en el celular, aparece al centro en la compu
export default function Hoja({ titulo, onCerrar, children }) {
  useEffect(() => {
    function alTeclear(e) { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div className="hoja-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-agarre" />
        {titulo && (
          <div className="hoja-header">
            <h2>{titulo}</h2>
            <button className="hoja-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
