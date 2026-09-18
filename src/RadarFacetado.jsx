export default function RadarFacetado({ categorias }) {
  const centro = { x: 150, y: 150 }
  const radio = 110
  const n = categorias.length

  // Calcula el punto (x,y) de una categoría según su % (0-100) y su posición en el círculo
  function punto(valor, indice) {
  const angulo = (Math.PI * 2 * indice) / n - Math.PI / 2
  const valorVisual = Math.max(valor, 8) // mínimo 8%, aunque el real sea menor
  const distancia = (valorVisual / 100) * radio
  return {
    x: centro.x + distancia * Math.cos(angulo),
    y: centro.y + distancia * Math.sin(angulo),
  }
}

  function puntoEtiqueta(indice) {
    const angulo = (Math.PI * 2 * indice) / n - Math.PI / 2
    const distancia = radio + 26
    return {
      x: centro.x + distancia * Math.cos(angulo),
      y: centro.y + distancia * Math.sin(angulo),
    }
  }

  const puntos = categorias.map((c, i) => punto(c.valor, i))

  // Anillos guía de fondo (círculos concéntricos en vez de líneas rectas)
  const anillos = [25, 50, 75, 100]

  return (
    <svg viewBox="0 0 300 300" className="radar-svg">
      <defs>
        <linearGradient id="facetaClaro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>

      {/* Anillos de fondo */}
      {anillos.map((r) => (
        <circle
          key={r}
          cx={centro.x} cy={centro.y}
          r={(r / 100) * radio}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}

      {/* Líneas radiales de cada eje */}
      {categorias.map((c, i) => {
        const p = punto(100, i)
        return (
          <line
            key={c.categoria}
            x1={centro.x} y1={centro.y}
            x2={p.x} y2={p.y}
            stroke="var(--border)"
            strokeWidth="1"
          />
        )
      })}

      {/* Triángulos facetados (cada uno un poco más claro/oscuro para dar efecto 3D) */}
      {puntos.map((p, i) => {
        const siguiente = puntos[(i + 1) % n]
        const opacidad = 0.55 + (i % 2 === 0 ? 0.15 : 0)
        return (
          <polygon
            key={i}
            points={`${centro.x},${centro.y} ${p.x},${p.y} ${siguiente.x},${siguiente.y}`}
            fill="url(#facetaClaro)"
            opacity={opacidad}
            stroke="#0f766e"
            strokeWidth="1"
          />
        )
      })}

      {/* Etiquetas de cada categoría */}
      {categorias.map((c, i) => {
        const p = puntoEtiqueta(i)
        return (
          <text
            key={c.categoria}
            x={p.x} y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="#1c1c1c"
          >
            {c.categoria}
          </text>
        )
      })}
    </svg>
  )
}