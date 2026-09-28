import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { fecha, accessToken } = req.body || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !accessToken) {
    return res.status(400).json({ error: 'Falta una fecha válida o la sesión' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  try {
    const { data: { user }, error: errUser } = await supabase.auth.getUser(accessToken)
    if (errUser || !user) {
      return res.status(401).json({ error: 'Sesión no válida' })
    }

    const [lect, journal, habitos, registros, palabra] = await Promise.all([
      supabase.from('lecturas_dia').select('evangelio_cita, evangelio_texto').eq('fecha', fecha).maybeSingle(),
      supabase.from('journal_entradas')
        .select('objetivo_dia, resumen, reflexion, aprendizaje').eq('fecha', fecha).maybeSingle(),
      supabase.from('habitos').select('id, nombre').eq('activo', true),
      supabase.from('habito_registros').select('habito_id').eq('fecha', fecha),
      supabase.from('palabra_entradas').select('reflexion').eq('fecha', fecha).maybeSingle(),
    ])

    if (!lect.data) {
      return res.status(404).json({ error: 'Primero abre las lecturas de ese día' })
    }

    const cumplidos = new Set((registros.data || []).map((r) => r.habito_id))
    const listaHabitos = (habitos.data || [])
      .map((h) => `${h.nombre}: ${cumplidos.has(h.id) ? 'cumplido' : 'no cumplido'}`)
      .join('\n')

    const j = journal.data || {}

        const prompt = `Eres Jarvis, un acompañante espiritual dentro de la app "Veni, Vidi, Vici".
Vas a escribir una oración en primera persona, dirigida a Dios, para que el usuario la rece hoy.

Cómo trabajar:
1. Lee el Evangelio del día y encuentra su idea central (una actitud, una virtud, una lucha humana que retrata).
2. Mira los datos del usuario (hábitos, diario, reflexión) y elige  momentos que conecten de verdad con esa idea central — no un resumen de todo su día.
3. Escribe la oración partiendo de esa conexión, no como una lista de lo que hizo.
4. Agradece, disculpate y pide. 

Reglas de forma:
- Español, tono sencillo, humilde, como quien habla con un padre, no como quien reporta un itinerario.
- Entre 80 y 130 palabras.
- Nunca enumeres actividades ("hice esto, esto y esto"). Si mencionas algo concreto de su día, que sea uno o dos detalles, usados como imagen o símbolo, no como lista.
- No inventes hechos que no estén en los datos, pero tampoco los repitas todos: elige y profundiza en pocos.
- No cites versículos textualmente; puedes aludir a la escena o al mensaje del Evangelio.
- Si el día tuvo caídas o incoherencias, trátalas con compasión y sin regaño, como parte normal de la lucha espiritual, no como el tema central de la oración.
- Responde SOLO con el texto de la oración, sin título, sin comillas, sin comentarios.

EVANGELIO DEL DÍA (${lect.data.evangelio_cita}):
${lect.data.evangelio_texto}

HÁBITOS DEL DÍA:
${listaHabitos || 'Sin hábitos registrados'}

DIARIO DEL DÍA:
Objetivo: ${j.objetivo_dia || '(vacío)'}
Resumen: ${j.resumen || '(vacío)'}
Reflexión: ${j.reflexion || '(vacío)'}
Aprendizaje: ${j.aprendizaje || '(vacío)'}

REFLEXIÓN DEL USUARIO SOBRE LA LECTURA:
${palabra.data?.reflexion || '(vacía)'}`

    const respGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const data = await respGemini.json()
    const oracion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!oracion) {
      return res.status(502).json({ error: 'Jarvis no pudo generar la oración' })
    }

    // Solo se envían user_id, fecha y oracion_ia: no se toca la reflexión ya guardada
    const { error } = await supabase
      .from('palabra_entradas')
      .upsert({ user_id: user.id, fecha, oracion_ia: oracion }, { onConflict: 'user_id,fecha' })
    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(200).json({ oracion })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}