import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { fecha, accessToken } = req.body
  if (!fecha || !accessToken) {
    return res.status(400).json({ error: 'Falta la fecha o la sesión' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const [entrada, habitos, registros] = await Promise.all([
    supabase.from('journal_entradas').select('*').eq('fecha', fecha).maybeSingle(),
    supabase.from('habitos').select('id, nombre').eq('activo', true),
    supabase.from('habito_registros').select('habito_id').eq('fecha', fecha),
  ])

  if (!entrada.data) {
    return res.status(404).json({ error: 'No hay entrada de journal para ese día' })
  }

  const cumplidos = new Set((registros.data || []).map((r) => r.habito_id))
  const listaHabitos = (habitos.data || []).map((h) =>
    `${h.nombre}: ${cumplidos.has(h.id) ? 'cumplido' : 'no cumplido'}`
  ).join('\n')

  const prompt = `Eres Jarvis, un coach personal directo y honesto dentro de la app "Veni, Vidi, Vici".
Analiza el día del usuario con la información de abajo y responde SOLO en este formato JSON, sin texto extra, sin markdown:
{"puntaje": <número del 1 al 10>, "comentario": "<una frase corta, máximo 20 palabras, directa>"}

HÁBITOS DEL DÍA:
${listaHabitos || 'Sin hábitos registrados'}

OBJETIVO DEL DÍA: ${entrada.data.objetivo_dia || '(vacío)'}
RESUMEN: ${entrada.data.resumen || '(vacío)'}
REFLEXIÓN: ${entrada.data.reflexion || '(vacío)'}
APRENDIZAJE: ${entrada.data.aprendizaje || '(vacío)'}`

  try {
    const respuestaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const data = await respuestaGemini.json()
    let texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    texto = texto.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(texto)

    await supabase.from('journal_entradas').update({
      puntaje_ia: resultado.puntaje,
      comentario_ia: resultado.comentario,
    }).eq('id', entrada.data.id)

    res.status(200).json(resultado)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}