import { createClient } from '@supabase/supabase-js'

// ---------- Utilidades de fechas (el servidor no está en la hora del usuario: usa la fecha que manda la app) ----------
function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function lunesDe(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00Z')
  return sumarDias(fechaISO, -((d.getUTCDay() + 6) % 7))
}
const L = (n) => `L. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`
const esColumnaHecha = (nombre = '') => /hecho|hecha|listo|lista|terminad|complet|done/i.test(nombre)

// Precios de los poderes de la tienda (mismos que en la app)
const PODERES = [
  ['Protector de racha', 15], ['Revivir racha', 60], ['Doble XP 24 h', 60],
  ['Título personalizado', 60], ['Fondo del Dashboard', 30], ['Día de descanso', 100],
]
const NIVELES = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande', epico: 'Épico' }
const PRECIOS = { pequeno: 10, mediano: 30, grande: 60, epico: 150 }

// Cada consulta es opcional: si una tabla no existe todavía, Jarvis sigue funcionando con lo demás
const filas = (q) => q.then((r) => (r.error ? [] : r.data || []))
const una = (q) => q.then((r) => (r.error ? null : r.data))

async function armarContexto(supabase, user, hoy) {
  const mes = hoy.slice(0, 7)
  const [a, m] = mes.split('-').map(Number)
  const finMes = `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
  const hace30 = sumarDias(hoy, -30)
  const hace60 = sumarDias(hoy, -60)
  const lunes = lunesDe(hoy)

  const [
    perfil, habitos, registros, especiales, journal, palabra,
    espacios, tableros, columnas, tarjetas,
    proyectos, etapas, metas,
    categorias, config, transacciones, metasFin, analisis,
    recompensas, compras, bonos,
  ] = await Promise.all([
    una(supabase.from('perfil').select('xp, nivel').eq('user_id', user.id).maybeSingle()),
    filas(supabase.from('habitos').select('id, nombre').eq('activo', true).order('orden')),
    filas(supabase.from('habito_registros').select('habito_id, fecha').gte('fecha', hace60)),
    filas(supabase.from('dias_especiales').select('fecha, tipo').gte('fecha', hace60)),
    filas(supabase.from('journal_entradas').select('fecha, objetivo_dia, resumen, reflexion, aprendizaje, puntaje_ia, comentario_ia').gte('fecha', sumarDias(hoy, -14)).order('fecha', { ascending: false })),
    filas(supabase.from('palabra_entradas').select('fecha').gte('fecha', hace30)),
    filas(supabase.from('espacios_trabajo').select('id, nombre')),
    filas(supabase.from('tableros').select('id, espacio_id')),
    filas(supabase.from('columnas').select('id, nombre, tablero_id')),
    // Con hora si ya existe la columna; si no, sin ella (para no quedarse sin tareas)
    supabase.from('tarjetas').select('titulo, fecha_limite, hora, columna_id, detalle_extra, completada_en')
      .then((r) => (r.error ? filas(supabase.from('tarjetas').select('titulo, fecha_limite, columna_id, detalle_extra')) : r.data || [])),
    filas(supabase.from('proyectos').select('id, nombre, estado, etiqueta, fecha_objetivo, descripcion')),
    filas(supabase.from('proyecto_etapas').select('proyecto_id, nombre, hecha, orden').order('orden')),
    filas(supabase.from('metas').select('titulo, tipo, valor_objetivo, valor_actual, completada, fecha_objetivo')),
    filas(supabase.from('presupuesto_categorias').select('id, tipo, grupo, nombre, monto_planeado').eq('activa', true)),
    una(supabase.from('presupuesto_config').select('*').maybeSingle()),
    filas(supabase.from('transacciones').select('tipo, monto, categoria, subcategoria, categoria_id, descripcion, fecha').gte('fecha', `${mes}-01`).lte('fecha', finMes).order('fecha', { ascending: false })),
    filas(supabase.from('metas_financieras').select('nombre, tipo, valor_objetivo, valor_actual, completada, cuota_mensual, total_pagos, fecha_objetivo')),
    una(supabase.from('analisis_financiero').select('fecha, puntaje, comentario').eq('mes', mes).order('fecha', { ascending: false }).limit(1).maybeSingle()),
    filas(supabase.from('recompensas').select('nombre, emoji, nivel, costo_monedas, monto_dinero, veces_canjeada')),
    filas(supabase.from('compras').select('clave, nombre, costo, usado_en, creado_en').order('creado_en', { ascending: false })),
    filas(supabase.from('bonos').select('monedas')),
  ])

  const partes = []

  // ---------- Finanzas ----------
  const ingresos = transacciones.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
  const porId = Object.fromEntries(categorias.map((c) => [c.id, c]))
  const grupoDe = (t) => porId[t.categoria_id]?.grupo || t.categoria
  const grupos = {}
  categorias.filter((c) => c.tipo === 'gasto').forEach((c) => {
    grupos[c.grupo] ??= { planeado: 0, gastado: 0, subs: {} }
    grupos[c.grupo].planeado += Number(c.monto_planeado)
    grupos[c.grupo].subs[c.nombre] = { planeado: Number(c.monto_planeado), gastado: 0 }
  })
  transacciones.filter((t) => t.tipo === 'gasto').forEach((t) => {
    const g = grupoDe(t) || 'Otros'
    const sub = porId[t.categoria_id]?.nombre || t.subcategoria || 'Otros'
    grupos[g] ??= { planeado: 0, gastado: 0, subs: {} }
    grupos[g].gastado += Number(t.monto)
    grupos[g].subs[sub] ??= { planeado: 0, gastado: 0 }
    grupos[g].subs[sub].gastado += Number(t.monto)
  })
  const ahorro = grupos.Ahorro || { planeado: 0, gastado: 0 }
  const gastos = Object.entries(grupos).filter(([g]) => g !== 'Ahorro').reduce((s, [, v]) => s + v.gastado, 0)
  const protegido = ingresos > 0 ? Math.min(ingresos, Math.max(ahorro.planeado, ahorro.gastado)) : ahorro.gastado
  const teQuedan = ingresos - protegido - gastos
  const reglas = config || { ahorro_minimo_pct: 20, entretenimiento_max_pct: 15 }

  partes.push(`## FINANZAS (${mes}, moneda: lempiras)
- Ingresos registrados este mes: ${L(ingresos)}${ingresos ? '' : ' (todavía no registra ingresos este mes)'}
- Gastos del mes (sin contar ahorro): ${L(gastos)}
- Saldo del mes: ${L(ingresos - gastos)}
- "Te quedan para tus gastos" (ingresos − ahorro protegido − gastos): ${L(teQuedan)}
- Ahorro protegido (no se toca): ${L(protegido)}
- Reglas: ahorro mínimo ${reglas.ahorro_minimo_pct}% del ingreso, entretenimiento máximo ${reglas.entretenimiento_max_pct}% del ingreso
- Presupuesto por grupo (gastado / planeado):
${Object.entries(grupos).map(([g, v]) => {
    const libre = v.planeado - v.gastado
    const subs = Object.entries(v.subs).map(([n, s]) => `${n} ${L(s.gastado)}/${L(s.planeado)}`).join(', ')
    return `  - ${g}: ${L(v.gastado)} / ${L(v.planeado)} (le quedan ${L(libre)}) → ${subs}`
  }).join('\n') || '  (sin presupuesto configurado)'}
- Últimos movimientos: ${transacciones.slice(0, 12).map((t) => `${t.fecha} ${t.tipo === 'ingreso' ? '+' : '-'}${L(t.monto)} ${t.subcategoria || t.categoria}${t.descripcion ? ` (${t.descripcion})` : ''}`).join('; ') || 'ninguno'}
- Metas de ahorro y deudas: ${metasFin.map((x) => x.tipo === 'deuda'
    ? `Deuda "${x.nombre}": pago ${Math.round(Number(x.valor_actual) / Number(x.cuota_mensual || 1))} de ${x.total_pagos}, cuota ${L(x.cuota_mensual)}${x.completada ? ' (pagada)' : ''}`
    : `"${x.nombre}": ${L(x.valor_actual)} de ${L(x.valor_objetivo)}${x.fecha_objetivo ? ` para ${x.fecha_objetivo}` : ''}${x.completada ? ' (lograda)' : ''}`).join('; ') || 'ninguna'}
${analisis ? `- Score financiero de hoy (Jarvis): ${analisis.puntaje}/100 — ${analisis.comentario}` : ''}`)

  // ---------- XP, monedas y tienda ----------
  const xp = Number(perfil?.xp) || 0
  const gastadas = compras.reduce((s, c) => s + (c.costo || 0), 0)
  const extra = bonos.reduce((s, b) => s + (b.monedas || 0), 0)
  const monedas = Math.floor(xp / 20) + extra - gastadas
  const protectores = compras.filter((c) => c.clave === 'protector' && !c.usado_en).length
  const doble = compras.find((c) => c.clave === 'doble_xp' && Date.now() - new Date(c.creado_en).getTime() < 86400000)
  partes.push(`## XP, MONEDAS Y TIENDA
- Nivel ${perfil?.nivel || 1}, XP total ${xp}. 1 moneda = 20 XP. Gastar monedas no baja el nivel.
- Monedas disponibles: ${monedas} 🪙
- Protectores de racha guardados: ${protectores}${doble ? ' · Doble XP ACTIVO ahora' : ''}
- Premios reales en su tienda (precio en monedas; algunos además cuestan dinero real):
${recompensas.map((r) => `  - ${r.emoji || ''} ${r.nombre} · ${NIVELES[r.nivel] || 'Pequeño'} · ${r.costo_monedas || PRECIOS[r.nivel] || 10} 🪙${r.monto_dinero ? ` · cuesta ~${L(r.monto_dinero)}` : ''}${r.veces_canjeada ? ` · canjeado ${r.veces_canjeada}×` : ''}`).join('\n') || '  (sin premios)'}
- Poderes: ${PODERES.map(([n, p]) => `${n} ${p} 🪙`).join(', ')}
- Últimas compras: ${compras.slice(0, 5).map((c) => `${c.nombre} (${c.creado_en.slice(0, 10)})`).join(', ') || 'ninguna'}`)

  // ---------- Tareas ----------
  const espacioDeTablero = Object.fromEntries(tableros.map((t) => [t.id, espacios.find((e) => e.id === t.espacio_id)?.nombre]))
  const colPorId = Object.fromEntries(columnas.map((c) => [c.id, c]))
  const tareas = tarjetas.map((t) => {
    const col = colPorId[t.columna_id]
    return { ...t, columna: col?.nombre, espacio: col && espacioDeTablero[col.tablero_id], hecha: col ? esColumnaHecha(col.nombre) : false }
  }).filter((t) => t.espacio)
  const pendientes = tareas.filter((t) => !t.hecha)
    .sort((x, y) => `${x.fecha_limite || '9999'} ${x.hora || '99'}`.localeCompare(`${y.fecha_limite || '9999'} ${y.hora || '99'}`))
  const estado = (f) => !f ? 'sin fecha' : f < hoy ? `VENCIDA (${f})` : f === hoy ? 'HOY' : f
  partes.push(`## TAREAS (espacios: ${espacios.map((e) => e.nombre).join(', ') || 'ninguno'})
- Pendientes (${pendientes.length}), ordenadas por fecha:
${pendientes.slice(0, 40).map((t) => `  - [${t.espacio}] ${t.titulo} · ${estado(t.fecha_limite)}${t.hora ? ` ${t.hora.slice(0, 5)}` : ""} · columna "${t.columna}"${t.detalle_extra ? ` · nota: ${t.detalle_extra.slice(0, 80)}` : ''}`).join('\n') || '  (ninguna)'}
- Completadas esta semana: ${tareas.filter((t) => t.completada_en && t.completada_en.slice(0, 10) >= lunes).length}`)

  // ---------- Hábitos ----------
  const marcados = new Set(registros.map((r) => `${r.habito_id}|${r.fecha}`))
  const especialesSet = new Map(especiales.map((e) => [e.fecha, e.tipo]))
  const perfecto = (f) => especialesSet.has(f) || (habitos.length > 0 && habitos.every((h) => marcados.has(`${h.id}|${f}`)))
  let racha = 0
  for (let f = sumarDias(hoy, -1); f >= hace60 && perfecto(f); f = sumarDias(f, -1)) racha++
  if (perfecto(hoy)) racha++
  const hechosHoy = habitos.filter((h) => marcados.has(`${h.id}|${hoy}`)).map((h) => h.nombre)
  const ult14 = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, -i))
  partes.push(`## HÁBITOS
- Activos: ${habitos.map((h) => h.nombre).join(', ') || 'ninguno'}
- Hoy lleva ${hechosHoy.length}/${habitos.length}: hechos [${hechosHoy.join(', ')}], faltan [${habitos.filter((h) => !hechosHoy.includes(h.nombre)).map((h) => h.nombre).join(', ')}]
- Racha actual de días perfectos: ${racha}
- Días perfectos en los últimos 14: ${ult14.filter(perfecto).length}
- Por hábito, veces cumplido en 14 días: ${habitos.map((h) => `${h.nombre} ${ult14.filter((f) => marcados.has(`${h.id}|${f}`)).length}/14`).join(', ')}`)

  // ---------- Proyectos y metas ----------
  partes.push(`## PROYECTOS
${proyectos.map((p) => {
    const lista = etapas.filter((e) => e.proyecto_id === p.id)
    const siguiente = lista.find((e) => !e.hecha)
    return `- ${p.nombre} [${p.estado}]${p.etiqueta ? ` #${p.etiqueta}` : ''}: ${lista.filter((e) => e.hecha).length}/${lista.length} etapas${siguiente ? `, siguiente: "${siguiente.nombre}"` : ''}${p.fecha_objetivo ? `, entrega ${p.fecha_objetivo}` : ''}`
  }).join('\n') || '(ninguno)'}

## METAS PERSONALES
${metas.map((x) => `- ${x.titulo}: ${x.valor_actual} de ${x.valor_objetivo} (${x.tipo})${x.fecha_objetivo ? `, fecha ${x.fecha_objetivo}` : ''}${x.completada ? ' — LOGRADA' : ''}`).join('\n') || '(ninguna)'}`)

  // ---------- Journal y Palabra ----------
  partes.push(`## JOURNAL (últimos 14 días, más reciente primero)
${journal.map((j) => `- ${j.fecha}${j.puntaje_ia ? ` (Jarvis ${j.puntaje_ia}/10)` : ''}: objetivo "${j.objetivo_dia || ''}", resumen "${(j.resumen || '').slice(0, 160)}", aprendizaje "${(j.aprendizaje || '').slice(0, 100)}"`).join('\n') || '(sin entradas)'}

## PALABRA
- Leyó la Palabra hoy: ${palabra.some((p) => p.fecha === hoy) ? 'sí' : 'no'} · días leídos en los últimos 30: ${new Set(palabra.map((p) => p.fecha)).size}`)

  return partes.join('\n\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { pregunta, accessToken, hoy, ahora, historial = [] } = req.body
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
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return res.status(401).json({ error: 'Sesión inválida' })

  const fechaHoy = /^\d{4}-\d{2}-\d{2}$/.test(hoy || '') ? hoy : new Date().toISOString().slice(0, 10)
  const contexto = await armarContexto(supabase, user, fechaHoy)

  const instrucciones = `Eres Jarvis, la entrenadora personal dentro de la app "Veni, Vidi, Vici". El nombre de la app es tu filosofía: vino, vio, venció.

PERSONALIDAD (lo más importante):
- Vas a la yugular. Disciplina casi militar: directa, exigente, sin rodeos y sin consentir. No eres una IA complaciente: no le das la razón al usuario solo porque sí, no lo apapachas, no usas diminutivos cariñosos ni frases de autoayuda.
- Si pone excusas o quiere aflojar, lo confrontas con SUS datos: hábitos pendientes, racha, tareas vencidas, presupuesto. Le recuerdas lo que él mismo se propuso.
- Hablas un poco suelta, natural, como alguien de confianza que no se anda con cuentos (español hondureño, puedes decir "mirá", "dale", "va", sin exagerar el slang). Firme, nunca grosera ni humillante.
- Ejemplo: si dice "me siento mal", no le dices que vaya a descansar de una. Le preguntas qué tiene exactamente: si es cansancio o flojera, lo empujas a cumplir lo mínimo (dile qué le falta hoy); si es algo físico de verdad, le dices qué es lo mínimo que sí puede hacer y que se recupere para volver al ataque mañana.
- Excepción: si describe algo serio de verdad (síntomas fuertes de salud, una crisis emocional, ideas de hacerse daño), deja el tono militar, responde con seriedad y empatía, y dile que busque ayuda de una persona o un profesional ya.

FORMA DE RESPONDER:
- No digas lo obvio. No menciones el día, la hora ni el momento ("hoy sábado por la noche…") a menos que lo pregunte o que sea necesario para la respuesta (fechas límite, "¿a qué hora…?", "¿cuándo…?").
- Breve: 1 a 4 frases, o una lista corta si hace falta. **Negritas** solo para lo clave.
- Montos en lempiras (L.) y monedas con 🪙. No inventes datos: si algo no está, dilo.
- No des asesoría de inversión específica.

CÓMO USAR LOS DATOS:
- Cruza secciones cuando la pregunta lo pida. Ejemplo: "¿puedo comer un pastel?" → revisa cuánto le queda para gastos y en Entretenimiento, y si tiene monedas para canjear un premio como "Postre". Da un veredicto claro: sí, no, o sí pero con condición.
- Tareas: busca por espacio o por palabras del título aunque las escriba distinto ("Métodos" = espacio "METODOS III"). Si no hay nada para hoy, di cuál es la más próxima y su fecha, en relativo ("el miércoles 15").

AGENDAR:
- Si te pide agendar, anotar o recordar algo ("ponme", "agéndame", "para mañana…", "el viernes tengo que…"), usa la herramienta crear_tareas. Puedes crear varias de una vez.
- Calcula la fecha exacta (AAAA-MM-DD) desde el contexto interno de abajo. "Mañana", "el viernes", "en 3 días" → fecha concreta. Si no dice día, es hoy.
- Hora en formato 24 h (3pm → 15:00). Si no dice hora, no la pongas.
- Título corto y claro, con mayúscula inicial y sin la fecha ni la hora ("Comprar verduras").
- Espacio: "Diario" salvo que nombre otro ("en Métodos" → el espacio que más se parezca).
- Si no queda claro QUÉ hay que hacer, pregunta antes de crear. Después de crearlas, confirma en una frase con su estilo (qué, cuándo y dónde).

Contexto interno (no lo menciones salvo que haga falta): ahora es ${ahora || fechaHoy} (fecha de hoy: ${fechaHoy}).

DATOS DEL USUARIO:
${contexto}`

  // La conversación vive solo mientras la pantalla está abierta: la app manda los últimos mensajes
  const turnos = historial.slice(-12)
    .filter((m) => m && typeof m.texto === 'string' && (m.rol === 'user' || m.rol === 'jarvis'))
    .map((m) => ({ role: m.rol === 'user' ? 'user' : 'model', parts: [{ text: m.texto.slice(0, 2000) }] }))
  while (turnos.length && turnos[0].role !== 'user') turnos.shift()

  const contents = [...turnos, { role: 'user', parts: [{ text: pregunta }] }]
  const preguntarAGemini = () => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucciones }] },
        tools: [{ functionDeclarations: [HERRAMIENTA_CREAR_TAREAS] }],
        contents,
      }),
    }
  ).then((r) => r.json())

  try {
    let data = await preguntarAGemini()
    let creadas = []

    // Si Jarvis decidió agendar: se crean las tareas y se le devuelve el resultado para que confirme
    const contenido = data.candidates?.[0]?.content
    const llamada = contenido?.parts?.find((p) => p.functionCall?.name === 'crear_tareas')?.functionCall
    if (llamada) {
      const resultado = await crearTareas(supabase, user, llamada.args?.tareas || [])
      creadas = resultado.creadas
      contents.push(contenido) // tal cual (incluye datos internos que Gemini necesita de vuelta)
      contents.push({ role: 'user', parts: [{ functionResponse: { name: 'crear_tareas', response: resultado } }] })
      data = await preguntarAGemini()
    }

    const texto = data.candidates?.[0]?.content?.parts?.filter((p) => p.text).map((p) => p.text).join('').trim()
    res.status(200).json({
      respuesta: texto || (creadas.length ? `Listo, agendé ${creadas.length} tarea(s).` : 'No pude generar una respuesta.'),
      creadas,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ---------- Agendar tareas desde el chat ----------
const HERRAMIENTA_CREAR_TAREAS = {
  name: 'crear_tareas',
  description: 'Crea una o varias tareas en la pestaña Tareas del usuario (por defecto en el espacio "Diario").',
  parameters: {
    type: 'OBJECT',
    properties: {
      tareas: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            titulo: { type: 'STRING', description: 'Qué hay que hacer, corto, sin fecha ni hora' },
            fecha: { type: 'STRING', description: 'Fecha límite en formato AAAA-MM-DD' },
            hora: { type: 'STRING', description: 'Hora en formato 24 h HH:MM (opcional)' },
            espacio: { type: 'STRING', description: 'Nombre del espacio de trabajo; si no lo dice, "Diario"' },
          },
          required: ['titulo', 'fecha'],
        },
      },
    },
    required: ['tareas'],
  },
}

const normalizar = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

async function crearTareas(supabase, user, tareas) {
  const creadas = []
  const errores = []
  const { data: espacios } = await supabase.from('espacios_trabajo').select('id, nombre')
  const lista = espacios || []

  // Busca el espacio por nombre (sin importar tildes ni mayúsculas); "Diario" se crea si no existe
  async function espacioPara(nombre) {
    const buscado = normalizar(nombre || 'Diario')
    const encontrado = lista.find((e) => normalizar(e.nombre) === buscado)
      || lista.find((e) => normalizar(e.nombre).includes(buscado) || buscado.includes(normalizar(e.nombre)))
    if (encontrado) return encontrado
    if (buscado !== 'diario') return null
    const { data: nuevo, error } = await supabase.from('espacios_trabajo')
      .insert({ nombre: 'Diario', user_id: user.id }).select('id, nombre').single()
    if (error) throw error
    lista.push(nuevo)
    return nuevo
  }

  // Primera columna del tablero del espacio (crea tablero y columnas base si faltan)
  async function columnaDe(espacio) {
    let { data: tablero } = await supabase.from('tableros').select('id').eq('espacio_id', espacio.id).limit(1).maybeSingle()
    if (!tablero) {
      const r = await supabase.from('tableros').insert({ nombre: espacio.nombre, espacio_id: espacio.id, user_id: user.id }).select('id').single()
      if (r.error) throw r.error
      tablero = r.data
    }
    let { data: cols } = await supabase.from('columnas').select('id, nombre, orden').eq('tablero_id', tablero.id).order('orden')
    if (!cols?.length) {
      const r = await supabase.from('columnas').insert(['Por hacer', 'En proceso', 'Hecho']
        .map((nombre, i) => ({ nombre, tablero_id: tablero.id, user_id: user.id, orden: i + 1 }))).select('id, nombre, orden')
      if (r.error) throw r.error
      cols = r.data.sort((a, b) => a.orden - b.orden)
    }
    return cols.find((c) => !esColumnaHecha(c.nombre)) || cols[0]
  }

  for (const t of tareas.slice(0, 10)) {
    const titulo = String(t.titulo || '').trim().slice(0, 200)
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(t.fecha || '') ? t.fecha : null
    const hora = /^\d{1,2}:\d{2}$/.test(t.hora || '') ? t.hora.padStart(5, '0') : null
    if (!titulo) { errores.push('Una tarea venía sin título'); continue }
    try {
      const espacio = await espacioPara(t.espacio)
      if (!espacio) { errores.push(`No existe el espacio "${t.espacio}"`); continue }
      const columna = await columnaDe(espacio)
      const { data: ultimas } = await supabase.from('tarjetas').select('orden').eq('columna_id', columna.id).order('orden', { ascending: false }).limit(1)
      const fila = { titulo, columna_id: columna.id, fecha_limite: fecha, user_id: user.id, orden: (ultimas?.[0]?.orden || 0) + 1 }
      let r = await supabase.from('tarjetas').insert({ ...fila, ...(hora && { hora }) }).select('id').single()
      if (r.error && hora) {
        // Falta el SQL de la hora: se guarda la hora en el título para no perderla
        r = await supabase.from('tarjetas').insert({ ...fila, titulo: `${hora} · ${titulo}` }).select('id').single()
      }
      if (r.error) throw r.error
      creadas.push({ id: r.data.id, titulo, fecha, hora, espacio: espacio.nombre })
    } catch (e) {
      errores.push(`No pude crear "${titulo}": ${e.message}`)
    }
  }
  return { creadas, errores }
}
