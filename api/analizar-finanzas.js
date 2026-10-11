import { createClient } from '@supabase/supabase-js'

function rangoDelMes(mes) {
  const [año, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(año, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimoDia).padStart(2, '0')}`, ultimoDia }
}

const L = (n) => `L. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { mes, fecha, accessToken } = req.body
  if (!mes || !fecha || !accessToken) {
    return res.status(400).json({ error: 'Falta el mes, la fecha o la sesión' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return res.status(401).json({ error: 'Sesión inválida' })

  const { desde, hasta, ultimoDia } = rangoDelMes(mes)
  const [cats, conf, trs, mts] = await Promise.all([
    supabase.from('presupuesto_categorias').select('*').eq('activa', true),
    supabase.from('presupuesto_config').select('*').maybeSingle(),
    supabase.from('transacciones').select('*').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('metas_financieras').select('*'),
  ])

  const categorias = cats.data || []
  const transacciones = trs.data || []
  const config = conf.data || { ingreso_referencia: 0, ahorro_minimo_pct: 20, entretenimiento_max_pct: 15 }
  const porId = Object.fromEntries(categorias.map((c) => [c.id, c]))

  const ingresos = transacciones.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
  // Igual que en la app: los porcentajes se calculan sobre lo que de verdad entró
  const base = ingresos
  const diaDelMes = Number(fecha.slice(8, 10))
  const avanceMes = fecha.slice(0, 7) === mes ? Math.round((diaDelMes / ultimoDia) * 100) : 100

  // Resumen por grupo y subcategoría: es lo que ve Jarvis y lo que se guarda para recordarlo después
  const grupos = {}
  categorias.filter((c) => c.tipo === 'gasto').forEach((c) => {
    grupos[c.grupo] ??= { planeado: 0, gastado: 0, subcategorias: {} }
    grupos[c.grupo].planeado += Number(c.monto_planeado)
    grupos[c.grupo].subcategorias[c.nombre] = { planeado: Number(c.monto_planeado), gastado: 0 }
  })
  transacciones.filter((t) => t.tipo === 'gasto').forEach((t) => {
    const cat = porId[t.categoria_id]
    const grupo = cat?.grupo || t.categoria || 'Otros'
    const sub = cat?.nombre || t.subcategoria || 'Otros'
    grupos[grupo] ??= { planeado: 0, gastado: 0, subcategorias: {} }
    grupos[grupo].gastado += Number(t.monto)
    grupos[grupo].subcategorias[sub] ??= { planeado: 0, gastado: 0 }
    grupos[grupo].subcategorias[sub].gastado += Number(t.monto)
  })

  const metas = (mts.data || []).map((m) => ({
    nombre: m.nombre,
    tipo: m.tipo || 'meta',
    actual: Number(m.valor_actual),
    objetivo: Number(m.valor_objetivo),
    fecha_objetivo: m.fecha_objetivo,
    completada: m.completada,
    ...(m.tipo === 'deuda' && {
      cuota: Number(m.cuota_mensual),
      pagos: `${Math.round(Number(m.valor_actual) / Number(m.cuota_mensual || 1))} de ${m.total_pagos}`,
    }),
  }))

  const datos = {
    mes, fecha, avance_del_mes_pct: avanceMes,
    ingresos_registrados: ingresos, ingreso_referencia: Number(config.ingreso_referencia),
    reglas: { ahorro_minimo_pct: Number(config.ahorro_minimo_pct), entretenimiento_max_pct: Number(config.entretenimiento_max_pct) },
    grupos, metas, movimientos: transacciones.length,
  }

  const lineasGrupos = Object.entries(grupos).map(([g, v]) => {
    const subs = Object.entries(v.subcategorias)
      .map(([n, s]) => `    - ${n}: ${L(s.gastado)} de ${L(s.planeado)}`).join('\n')
    const pctIngreso = base ? Math.round((v.gastado / base) * 100) : 0
    return `- ${g}: gastado ${L(v.gastado)} de ${L(v.planeado)} planeado (${pctIngreso}% del ingreso)\n${subs}`
  }).join('\n')

  const lineasMetas = metas.map((m) => m.tipo === 'deuda'
    ? `- Deuda "${m.nombre}": pago ${m.pagos}, cuota ${L(m.cuota)}${m.completada ? ' (pagada)' : ''}`
    : `- Meta "${m.nombre}": ${L(m.actual)} de ${L(m.objetivo)}${m.fecha_objetivo ? `, fecha ${m.fecha_objetivo}` : ''}${m.completada ? ' (lograda)' : ''}`
  ).join('\n')

  const prompt = `Eres Jarvis, el coach financiero personal y directo dentro de la app "Veni, Vidi, Vici". La moneda es lempiras (L.).
Analiza cómo van las finanzas del usuario este mes y responde SOLO en este formato JSON, sin texto extra, sin markdown:
{"puntaje": <número entero de 0 a 100>, "comentario": "<máximo 25 palabras, en español, directo y concreto, menciona la categoría o subcategoría más relevante>"}

Criterios del puntaje: respeto al presupuesto por grupo considerando el avance del mes, ahorro frente a lo planeado y su regla mínima, entretenimiento frente a su regla máxima, metas y deudas al día, constancia registrando.
Nunca recomiendes inversiones específicas.

MES: ${mes} (hoy es ${fecha}, va el ${avanceMes}% del mes)
INGRESOS REGISTRADOS: ${L(ingresos)}${ingresos ? "" : " (todavía no registra ingresos este mes)"} (referencia mensual: ${L(config.ingreso_referencia)})
REGLAS: ahorro mínimo ${config.ahorro_minimo_pct}% del ingreso, entretenimiento máximo ${config.entretenimiento_max_pct}% del ingreso
MOVIMIENTOS REGISTRADOS: ${transacciones.length}

PRESUPUESTO POR GRUPO:
${lineasGrupos || 'Sin presupuesto'}

METAS Y DEUDAS:
${lineasMetas || 'Sin metas'}`

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
    const puntaje = Math.max(0, Math.min(100, Math.round(Number(resultado.puntaje) || 0)))
    const comentario = String(resultado.comentario || '').slice(0, 300)

    const { data: guardado, error } = await supabase.from('analisis_financiero').upsert({
      user_id: user.id, fecha, mes, puntaje, comentario, datos,
    }, { onConflict: 'user_id,fecha' }).select().single()
    if (error) throw error

    res.status(200).json(guardado)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
