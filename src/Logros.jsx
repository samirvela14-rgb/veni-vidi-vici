import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ultimosNDias } from './fechas'

const CATALOGO = [
  { clave: 'racha_7', titulo: 'Una semana entera', descripcion: '7 días seguidos con todos tus hábitos cumplidos' },
  { clave: 'racha_30', titulo: 'Un mes de hierro', descripcion: '30 días seguidos con todos tus hábitos cumplidos' },
  { clave: 'nivel_10', titulo: 'Nivel 10', descripcion: 'Llegaste al nivel 10' },
  { clave: 'nivel_25', titulo: 'Nivel 25', descripcion: 'Llegaste al nivel 25' },
  { clave: 'nivel_50', titulo: 'Nivel 50', descripcion: 'Llegaste al nivel 50' },
  { clave: 'primera_meta', titulo: 'Primera meta', descripcion: 'Completaste tu primera meta financiera' },
]

export default function Logros() {
  const [desbloqueados, setDesbloqueados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function revisar() {
      const { data: { user } } = await supabase.auth.getUser()

      const [{ data: habitos }, { data: registros }, { data: perfil }, { data: metas }, { data: yaGuardados }] =
        await Promise.all([
          supabase.from('habitos').select('id').eq('activo', true),
          supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', ultimosNDias(30)[0]),
          supabase.from('perfil').select('nivel').eq('user_id', user.id).maybeSingle(),
          supabase.from('metas_financieras').select('id').eq('completada', true).limit(1),
          supabase.from('logros').select('clave'),
        ])

      const dias30 = ultimosNDias(30)
      function diaCompleto(f) {
        return habitos.length > 0 && habitos.every((h) =>
          registros.some((r) => r.habito_id === h.id && r.fecha === f)
        )
      }
      let racha = 0, mejor = 0
      dias30.forEach((f) => {
        if (diaCompleto(f)) { racha++; mejor = Math.max(mejor, racha) } else racha = 0
      })

      const nivel = perfil?.nivel || 1
      const yaTiene = new Set((yaGuardados || []).map((l) => l.clave))

      const logica = {
        racha_7: mejor >= 7,
        racha_30: mejor >= 30,
        nivel_10: nivel >= 10,
        nivel_25: nivel >= 25,
        nivel_50: nivel >= 50,
        primera_meta: (metas || []).length > 0,
      }

      const nuevos = CATALOGO.filter((l) => logica[l.clave] && !yaTiene.has(l.clave))
      if (nuevos.length > 0) {
        await supabase.from('logros').insert(
          nuevos.map((l) => ({ user_id: user.id, clave: l.clave, titulo: l.titulo, descripcion: l.descripcion }))
        )
      }

      const { data: final } = await supabase.from('logros').select('clave')
      setDesbloqueados(new Set((final || []).map((l) => l.clave)))
      setCargando(false)
    }
    revisar()
  }, [])

  if (cargando) return <p className="vacio">Revisando logros...</p>

  return (
    <div className="logros-lista">
      {CATALOGO.map((l) => {
        const tiene = desbloqueados.has(l.clave)
        return (
          <div key={l.clave} className={`logro-card ${tiene ? '' : 'logro-bloqueado'}`}>
            <span className="logro-icono">{tiene ? '🏅' : '🔒'}</span>
            <div>
              <strong>{l.titulo}</strong>
              <p className="logro-descripcion">{l.descripcion}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}