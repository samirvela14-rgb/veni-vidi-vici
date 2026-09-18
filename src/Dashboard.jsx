import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import RadarFacetado from './RadarFacetado'
import { ArrowUp, Sparkles, Award, Store, GraduationCap } from 'lucide-react'

export function hoyISO() {
  const d = new Date()
  const año = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}
function haceNDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const año = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

function calcularSaludo() {
  const ahora = new Date()
  const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes()
  const inicioBuenDia = 4 * 60 + 50   // 4:50am
  const finBuenDia = 19 * 60          // 7:00pm (exclusivo)
  const esBuenDia = minutosDelDia >= inicioBuenDia && minutosDelDia < finBuenDia
  return esBuenDia ? 'Buen día' : 'Linda noche'
}

export default function Dashboard({ irA }) {
  const [cargando, setCargando] = useState(true)
  const [datos, setDatos] = useState(null)
  const [vistaGamif, setVistaGamif] = useState(null)

  useEffect(() => {
    async function cargar() {
      const hoy = hoyISO()
      const hace7 = haceNDias(7)
      const { data: { user } } = await supabase.auth.getUser()

      const [habitos, registros7d, journal7d, perfil] = await Promise.all([
        supabase.from('habitos').select('id').eq('activo', true),
        supabase.from('habito_registros').select('fecha').gte('fecha', hace7),
        supabase.from('journal_entradas').select('puntaje_ia').gte('fecha', hace7).not('puntaje_ia', 'is', null),
        supabase.from('perfil').select('xp, nivel').eq('user_id', user.id).maybeSingle(),
      ])

      const totalHabitos = habitos.data?.length || 0
      const posibles = totalHabitos * 7
      const scoreDisciplina = posibles ? Math.round((registros7d.data.length / posibles) * 100) : 0

      const puntajes = journal7d.data?.map((j) => j.puntaje_ia) || []
      const scoreMental = puntajes.length
        ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10)
        : 0

      setDatos({
        totalHabitos, scoreDisciplina, scoreMental,
        tieneMental: puntajes.length > 0,
        xp: perfil.data?.xp || 0,
        nivel: perfil.data?.nivel || 1,
      })
      setCargando(false)
    }
    cargar()
  }, [])

  if (cargando) return <p className="vacio">Cargando...</p>

  const { scoreDisciplina, scoreMental, tieneMental, xp, nivel, totalHabitos } = datos
  const categorias = [
    { categoria: 'Físico', valor: 0 },
    { categoria: 'Mental', valor: scoreMental },
    { categoria: 'Productividad', valor: 0 },
    { categoria: 'Financiero', valor: 0 },
    { categoria: 'Disciplina', valor: scoreDisciplina },
  ]

  const xpDelNivel = xp % 200
  const pctNivel = Math.round((xpDelNivel / 200) * 100)
  const saludo = calcularSaludo()

  return (
    <div className="dashboard-flow">
      <div className="dashboard-flow-top">
        <div className="dashboard-hero-content">
          <h1 className="dashboard-titulo-app">Veni, Vidi, Vici</h1>
          <h2 className="dashboard-saludo-grande">{saludo}</h2>
        </div>
        <button className="boton-jarvis-esquina" onClick={() => irA('jarvis')}>
          Hablar con Jarvis
        </button>
      </div>

      <div className="dashboard-flow-bottom">
        <div className="gamif-glass">
          <div className="radar-y-lvl">
            <div className="radar-contenedor">
              <RadarFacetado categorias={categorias} />
            </div>

            <div className="lvl-xp-bloque">
              <span className="lvl-texto">LVL {String(nivel).padStart(3, '0')}</span>
              <span className="xp-decorativo">
                <ArrowUp size={16} strokeWidth={3} />
                XP
                <Sparkles size={16} />
              </span>
              <div className="barra-nivel">
                <div className="barra-nivel-relleno" style={{ width: `${pctNivel}%` }} />
              </div>
              <span className="xp-detalle">{xpDelNivel} / 200 XP</span>
            </div>
          </div>

          <div className="gamif-botones">
            <button className="gamif-boton" onClick={() => setVistaGamif('logros')}>
              <Award size={28} strokeWidth={1.5} />
              Logros
            </button>
            <button className="gamif-boton" onClick={() => setVistaGamif('tienda')}>
              <Store size={28} strokeWidth={1.5} />
              Tienda
            </button>
            <button className="gamif-boton" onClick={() => setVistaGamif('titulos')}>
              <GraduationCap size={28} strokeWidth={1.5} />
              Títulos
            </button>
          </div>

          {vistaGamif && (
            <div className="gamif-placeholder">
              {vistaGamif === 'logros' ? 'Logros' : vistaGamif === 'tienda' ? 'Tienda' : 'Títulos'} — lo construimos pronto.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}