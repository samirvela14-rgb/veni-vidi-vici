import { TITULOS, tituloPorNivel } from './xp'

export default function Titulos({ nivelActual }) {
  const actual = tituloPorNivel(nivelActual)
  return (
    <div className="titulos-lista">
      {TITULOS.map((t, i) => {
        const siguiente = TITULOS[i + 1]
        const rango = siguiente ? `Nivel ${t.nivelMin}–${siguiente.nivelMin - 1}` : `Nivel ${t.nivelMin}+`
        return (
          <div key={t.nombre} className={`titulo-card ${t.nombre === actual ? 'titulo-actual' : ''}`}>
            <strong>{t.nombre}</strong>
            <span className="detalle">{rango}</span>
            {t.nombre === actual && <span className="chip-etiqueta">Actual</span>}
          </div>
        )
      })}
    </div>
  )
}