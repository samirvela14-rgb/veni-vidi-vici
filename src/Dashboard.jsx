import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function haceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function Dashboard({ irA }) {
  const [cargando, setCargando] = useState(true)
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    async function cargar() {
      const hoy = hoyISO()
      const hace7 = haceNDias(7)

      const [habitos, registros7d, journal7d, journalHoy, metas] = await Promise.all([
        supabase.from('habitos').select('id').eq('activo', true),
        supabase.from('habito_registros').select('fecha').gte('fecha', hace7),
        supabase.from('journal_entradas').select('puntaje_ia').gte('fecha', hace7).not('puntaje_ia', 'is', null),
        supabase.from('journal_entradas').select('puntaje_ia, comentario_ia').eq('fecha', hoy).maybeSingle(),
        supabase.from('metas').select('*').eq('completada', false).order('creado_en', { ascending: false }).limit(3),
      ])

      const totalHabitos = habitos.data?.length || 0
      const posiblesEn7d = totalHabitos * 7
      const hechosEn7d = registros7d.data?.length || 0
      const scoreDisciplina = posiblesEn7d ? Math.round((hechosEn7d / posiblesEn7d) * 100) : 0

      const puntajes = journal7d.data?.map((j) => j.puntaje_ia) || []
      const scoreMental = puntajes.length
        ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10)
        : 0

      setDatos({
        totalHabitos,
        scoreDisciplina,
        scoreMental,
        tieneDatosMental: puntajes.length > 0,
        journalHoy: journalHoy.data || null,
        metas: metas.data || [],
      })
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) return <p className="vacio">Cargando...</p>

  const { scoreDisciplina, scoreMental, tieneDatosMental, journalHoy, metas, totalHabitos } = datos

  const categoriasRadar = [
    { categoria: 'Físico', valor: 0, real: false },
    { categoria: 'Mental', valor: scoreMental, real: tieneDatosMental },
    { categoria: 'Productividad', valor: 0, real: false },
    { categoria: 'Financiero', valor: 0, real: false },
    { categoria: 'Disciplina', valor: scoreDisciplina, real: totalHabitos > 0 },
  ]

  const scoresReales = categoriasRadar.filter((c) => c.real).map((c) => c.valor)
  const scoreGeneral = scoresReales.length
    ? Math.round(scoresReales.reduce((a, b) => a + b, 0) / scoresReales.length)
    : 0

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="seccion">
      <h2 className="dashboard-saludo">{saludo}</h2>

      {metas.length > 0 && (
        <div className="dashboard-card">
          <div className="dashboard-card-titulo">🎯 Mis Metas</div>
          {metas.map((m) => {
            const pct = Math.min(100, Math.round((m.valor_actual / m.valor_objetivo) * 100))
            return (
              <div key={m.id} className="meta-mini">
                <div className="meta-mini-header">
                  <span>{m.emoji} {m.titulo}</span>
                  <span className="verde">{pct}%</span>
                </div>
                <div className="barra-progreso barra-mini">
                  <div className="barra-relleno" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="radar-score-fila">
        <div className="dashboard-card radar-card">
          <div className="dashboard-card-titulo">📊 Radar de Rendimiento</div>
          <div className="radar-contenedor">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={categoriasRadar}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="categoria" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Radar dataKey="valor" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="radar-score-central">
              <span className="radar-score-numero">{scoreGeneral}</span>
              <span className="radar-score-label">SCORE</span>
            </div>
          </div>
        </div>

        <div className="score-grid">
          {categoriasRadar.map((c) => (
            <button
              key={c.categoria}
              className={`score-card ${!c.real ? 'score-card-proximamente' : ''}`}
              onClick={() => (c.categoria === 'Disciplina' || c.categoria === 'Mental') && irA('habitos')}
            >
              <span className="score-card-titulo">{c.categoria.toUpperCase()}</span>
              {c.real ? (
                <>
                  <span className="score-card-valor">{c.valor}</span>
                  <span className="score-card-sub">
                    {c.categoria === 'Disciplina' && `${totalHabitos} hábitos activos`}
                    {c.categoria === 'Mental' && (journalHoy ? `Hoy: ${journalHoy.puntaje_ia}/10` : 'Últimos 7 días')}
                  </span>
                </>
              ) : (
                <span className="score-card-proximamente-label">Próximamente</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <button className="dashboard-tile-grande" onClick={() => irA('jarvis')}>
        <div className="dashboard-tile-header">
          <span>🤖 Hablar con Jarvis</span>
        </div>
        <span className="dashboard-tile-sub">Pregúntale sobre tu progreso</span>
      </button>
    </div>
  )
}