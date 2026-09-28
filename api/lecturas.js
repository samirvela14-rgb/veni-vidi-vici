import { createClient } from '@supabase/supabase-js'

// Convierte el HTML de la página en texto plano, una línea por bloque
function htmlATexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|section|article)>/gi, '\n')
    .replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

const ENCABEZADOS = [
  'Primera Lectura', 'Salmo Responsorial', 'Segunda Lectura',
  'Evangelio', 'Aleluya', 'Secuencia', 'Aclamación antes del Evangelio',
]
const MARCAS_FINAL = ['Sitios de noticias EWTN', 'Afiliados', 'Más información']

// Una cita bíblica se ve así: "Mateo 21:28-32", "1 Corintios 3:1-9", "Salmo 118(117):1-2"
const PATRON_CITA =
  /^(?:[1-3]\s?)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]*\.?\s\d{1,3}(?:\s?\(\d+\))?[:,]\d/

// Busca la sección `nombre`. Entre el encabezado y la cita puede haber etiquetas
// cortas (como "Primera Opción" / "Segunda Opción"), así que se mira hasta 6 líneas adelante.
function extraerSeccion(lineas, nombre, desde = 0) {
  for (let i = desde; i < lineas.length; i++) {
    if (lineas[i] !== nombre) continue

    let posCita = -1
    for (let j = i + 1; j <= i + 6 && j < lineas.length; j++) {
      if (ENCABEZADOS.includes(lineas[j])) break // era una pestaña, no la sección real
      if (PATRON_CITA.test(lineas[j])) { posCita = j; break }
    }
    if (posCita === -1) continue

    const cuerpo = []
    for (let k = posCita + 1; k < lineas.length && cuerpo.length < 400; k++) {
      const l = lineas[k]
      if (ENCABEZADOS.includes(l) || MARCAS_FINAL.includes(l)) break
      // otra cita = empieza la versión corta de la misma lectura: nos quedamos con la larga
      if (PATRON_CITA.test(l)) break
      // quita el número de versículo pegado al inicio ("28»¿Qué..." -> "»¿Qué...")
      cuerpo.push(l.replace(/^\d{1,3}(?=[^\d\s])/, ''))
    }
    return { cita: lineas[posCita], texto: cuerpo.join('\n'), inicio: i }
  }
  return { cita: null, texto: null, inicio: -1 }
}

function parsear(texto) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter((l) => l !== '')

  const primera = extraerSeccion(lineas, 'Primera Lectura')
  const desde = Math.max(primera.inicio, 0)
  const salmo = extraerSeccion(lineas, 'Salmo Responsorial', desde)
  const segunda = extraerSeccion(lineas, 'Segunda Lectura', desde)
  const evangelio = extraerSeccion(lineas, 'Evangelio', desde)

  // El nombre del día (ej. "XXVI Domingo Ordinario") está unas líneas antes de la primera lectura
  let titulo = null
  for (let i = primera.inicio - 1; i >= Math.max(0, primera.inicio - 4); i--) {
    const l = lineas[i]
    if (l.length < 90 && /(Domingo|Feria|Memoria|Fiesta|Solemnidad|San |Santa |Santos)/.test(l)) {
      titulo = l
      break
    }
  }

  return {
    titulo_liturgico: titulo,
    primera_cita: primera.cita, primera_texto: primera.texto,
    salmo_cita: salmo.cita, salmo_texto: salmo.texto,
    segunda_cita: segunda.cita, segunda_texto: segunda.texto,
    evangelio_cita: evangelio.cita, evangelio_texto: evangelio.texto,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const { fecha, accessToken } = req.body || {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !accessToken) {
    return res.status(400).json({ error: 'Falta una fecha válida (AAAA-MM-DD) o la sesión' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  try {
    // 1) ¿Ya la descargamos antes? Entonces no molestamos a EWTN otra vez
    const { data: guardada } = await supabase
      .from('lecturas_dia').select('*').eq('fecha', fecha).maybeSingle()
    if (guardada) return res.status(200).json(guardada)

    // 2) Si no, la descargamos y la parseamos
    const resp = await fetch(`https://www.ewtn.com/es/catolicismo/lecturas/${fecha}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es' },
    })
    if (!resp.ok) {
      return res.status(502).json({ error: `EWTN respondió con estado ${resp.status}` })
    }

    const lecturas = parsear(htmlATexto(await resp.text()))

    // Si no salió lo básico, no guardamos basura
    if (!lecturas.primera_texto || !lecturas.evangelio_texto) {
      return res.status(502).json({
        error: 'No pude leer las lecturas de esa fecha (puede que la página haya cambiado de formato)',
      })
    }

    const { error } = await supabase.from('lecturas_dia').insert({ fecha, ...lecturas })
    // 23505 = ya la guardó otra petición al mismo tiempo, no es un problema
    if (error && error.code !== '23505') {
      return res.status(500).json({ error: error.message })
    }

    res.status(200).json({ fecha, ...lecturas })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}