import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { pregunta, accessToken } = req.body
  if (!pregunta || !accessToken) {
    return res.status(400).json({ error: 'Falta la pregunta o la sesión' })
  }

  // Cliente de Supabase que actúa "como tú" usando tu token de sesión,
  // así RLS sigue protegiendo tus datos incluso desde el servidor.
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const hace30 = new Date()
  hace30.setDate(hace30.getDate() - 30)
  const fechaCorte = hace30.toISOString().slice(0, 10)

  const [habitos, registros, journal, metas, proyectos] = await Promise.all([
    supabase.from('habitos').select('id, nombre').eq('activo', true),
    supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', fechaCorte),
    supabase.from('journal_entradas')
      .select('fecha, objetivo_dia, resumen, reflexion, aprendizaje')
      .gte('fecha', fechaCorte).order('fecha', { ascending: false }),
    supabase.from('metas').select('titulo, valor_objetivo, valor_actual, tipo'),
    supabase.from('proyectos').select('nombre, estado, etapas_total, etapas_hechas'),
  ])

  const contexto = `Eres Jarvis, el asistente personal dentro de la app "Veni, Vidi, Vici".
Tienes acceso a los datos reales del usuario. Responde breve, directo y honesto, como un coach que lo conoce bien. No inventes datos que no estén aquí. Si no hay suficiente información para algo, dilo.

HÁBITOS ACTIVOS:
${JSON.stringify(habitos.data)}

REGISTROS DE CUMPLIMIENTO (últimos 30 días):
${JSON.stringify(registros.data)}

JOURNALING (últimos 30 días, más reciente primero):
${JSON.stringify(journal.data)}

METAS:
${JSON.stringify(metas.data)}

PROYECTOS:
${JSON.stringify(proyectos.data)}

Pregunta del usuario: ${pregunta}`

  try {
    const respuestaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: contexto }] }] }),
      }
    )
    const data = await respuestaGemini.json()
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.'
    res.status(200).json({ respuesta: texto })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}