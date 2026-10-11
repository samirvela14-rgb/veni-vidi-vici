import Hoja from '../ui/Hoja'
import { RAREZAS } from './logros'

export default function HojaLogros({ logros, onCerrar }) {
  const total = logros.length
  const tengo = logros.filter((l) => l.desbloqueado).length
  const areas = [...new Set(logros.map((l) => l.area))]

  return (
    <Hoja titulo="Logros" onCerrar={onCerrar}>
      <div className="logros">
        <div className="logros-resumen">
          <span className="logros-num">{tengo}<span>/{total}</span></span>
          <div className="barra-progreso barra-mini">
            <div className="barra-relleno" style={{ width: `${total ? (tengo / total) * 100 : 0}%` }} />
          </div>
          <span className="texto-suave">
            {Object.values(RAREZAS).map((r) => `${r.emoji} +${r.monedas} 🪙`).join(' · ')}
          </span>
        </div>

        {areas.map((area) => (
          <section key={area} className="logros-area">
            <span className="etiqueta-grupo">{area}</span>
            <ul>
              {logros.filter((l) => l.area === area).map((l) => (
                <li key={l.clave} className={l.desbloqueado ? 'tengo' : ''}>
                  <span className="logro-medalla">{l.desbloqueado ? RAREZAS[l.rareza].emoji : '🔒'}</span>
                  <div className="logro-texto">
                    <span className="logro-titulo">{l.titulo}</span>
                    <span className="texto-suave">{l.descripcion}</span>
                    {!l.desbloqueado && l.meta > 1 && (
                      <div className="barra-con-pct">
                        <div className="barra-progreso barra-mini">
                          <div className="barra-relleno" style={{ width: `${(l.actual / l.meta) * 100}%` }} />
                        </div>
                        <span>{l.actual}/{l.meta}</span>
                      </div>
                    )}
                  </div>
                  <span className="logro-premio">+{RAREZAS[l.rareza].monedas} 🪙</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Hoja>
  )
}
