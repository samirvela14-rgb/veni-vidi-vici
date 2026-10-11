export default function Anillo({ pct, texto, color = 'var(--wine)', size = 72 }) {
  const radio = 30
  const circunferencia = 2 * Math.PI * radio
  const relleno = Math.max(0, Math.min(100, pct || 0))
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className="anillo" aria-hidden="true">
      <circle cx="36" cy="36" r={radio} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={radio}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - relleno / 100)}
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="36" y="41" textAnchor="middle" className="anillo-texto">{texto}</text>
    </svg>
  )
}
