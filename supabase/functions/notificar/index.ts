// Función de Supabase "notificar": la llama la tarea programada cada 15 minutos.
// - 7:00 am (hora de Honduras): resumen del día (tareas con hora + cuánto queda para gastar)
// - Tareas con hora: aviso cuando faltan 30 minutos o menos (llega entre 15 y 30 min antes)
// Cada aviso se anota en notificaciones_enviadas para no repetirlo.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const ZONA_HORAS = -6 // Honduras: UTC-6 todo el año (sin horario de verano)
const HORA_RESUMEN = 7 * 60 // 7:00 am, en minutos del día
const VENTANA_AVISO = 30 // minutos hacia adelante que revisa cada corrida

const esColumnaHecha = (nombre = '') => /hecho|hecha|listo|lista|terminad|complet|done/i.test(nombre)
const L = (n: number) => `L. ${Math.round(n || 0).toLocaleString('en-US')}`

function formatoHora(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

// "Ahora" en Honduras: fecha AAAA-MM-DD y minutos del día
function ahoraLocal() {
  const d = new Date(Date.now() + ZONA_HORAS * 3600_000)
  return { hoy: d.toISOString().slice(0, 10), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notificaciones@venividivici.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const { hoy, minutos } = ahoraLocal()
  const { data: suscripciones } = await supabase.from('push_suscripciones').select('*')
  const usuarios = [...new Set((suscripciones ?? []).map((s) => s.user_id))]
  let enviadas = 0

  // Anota el aviso; si ya estaba anotado, devuelve false (no se repite)
  async function anotar(user_id: string, clave: string) {
    const { error } = await supabase.from('notificaciones_enviadas').insert({ user_id, clave })
    return !error
  }

  async function enviar(user_id: string, aviso: Record<string, string>) {
    for (const s of (suscripciones ?? []).filter((x) => x.user_id === user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(aviso),
          { TTL: 3600 },
        )
        enviadas++
      } catch (e) {
        // El teléfono ya no acepta avisos (desinstaló la app o quitó el permiso): se olvida
        const codigo = (e as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) await supabase.from('push_suscripciones').delete().eq('id', s.id)
      }
    }
  }

  for (const user_id of usuarios) {
    const [{ data: columnas }, { data: tarjetas }] = await Promise.all([
      supabase.from('columnas').select('id, nombre').eq('user_id', user_id),
      supabase.from('tarjetas').select('id, titulo, fecha_limite, hora, columna_id').eq('user_id', user_id).lte('fecha_limite', hoy),
    ])
    const hechas = new Set((columnas ?? []).filter((c) => esColumnaHecha(c.nombre)).map((c) => c.id))
    const pendientes = (tarjetas ?? []).filter((t) => !hechas.has(t.columna_id))
    const deHoy = pendientes.filter((t) => t.fecha_limite === hoy)
      .sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
    const vencidas = pendientes.filter((t) => t.fecha_limite < hoy)

    // ---------- Resumen de las 7 am ----------
    if (minutos >= HORA_RESUMEN && minutos < HORA_RESUMEN + 30 && await anotar(user_id, `resumen-${hoy}`)) {
      const queda = await cuantoQueda(supabase, user_id, hoy)
      const lineas = deHoy.slice(0, 6).map((t) => `${t.hora ? formatoHora(t.hora) : 'Sin hora'} · ${t.titulo}`)
      if (deHoy.length > 6) lineas.push(`y ${deHoy.length - 6} más`)
      const cuerpo = [
        deHoy.length ? lineas.join('\n') : 'Hoy no tienes tareas agendadas.',
        vencidas.length ? `⚠️ ${vencidas.length} vencida${vencidas.length === 1 ? '' : 's'}` : '',
        queda !== null ? `💸 Te quedan ${L(queda)} para gastar este mes` : '',
      ].filter(Boolean).join('\n')
      await enviar(user_id, {
        titulo: deHoy.length ? `Hoy tienes ${deHoy.length} tarea${deHoy.length === 1 ? '' : 's'}` : 'Tu día',
        cuerpo,
        etiqueta: `resumen-${hoy}`,
        url: '/?ir=tareas',
      })
    }

    // ---------- Avisos antes de cada tarea con hora ----------
    for (const t of deHoy.filter((x) => x.hora)) {
      const [h, m] = t.hora.split(':').map(Number)
      const faltan = h * 60 + m - minutos
      if (faltan <= 0 || faltan > VENTANA_AVISO) continue
      if (!await anotar(user_id, `tarea-${t.id}-${hoy}T${t.hora.slice(0, 5)}`)) continue
      await enviar(user_id, {
        titulo: `En ${faltan} min: ${t.titulo}`,
        cuerpo: `A las ${formatoHora(t.hora)}. ¡A darle!`,
        etiqueta: `tarea-${t.id}`,
        url: '/?ir=tareas',
      })
    }
  }

  return Response.json({ ok: true, hoy, minutos, usuarios: usuarios.length, enviadas })
})

// "Te quedan para tus gastos" del mes: ingresos − ahorro protegido − gastos (igual que en la app)
async function cuantoQueda(supabase: ReturnType<typeof createClient>, user_id: string, hoy: string) {
  const mes = hoy.slice(0, 7)
  const [a, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const [{ data: cats }, { data: trs }] = await Promise.all([
    supabase.from('presupuesto_categorias').select('grupo, monto_planeado').eq('user_id', user_id).eq('activa', true),
    supabase.from('transacciones').select('tipo, monto, categoria').eq('user_id', user_id).gte('fecha', `${mes}-01`).lte('fecha', `${mes}-${ultimoDia}`),
  ])
  if (!trs) return null
  const ingresos = trs.filter((t) => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
  const ahorroGastado = trs.filter((t) => t.tipo === 'gasto' && t.categoria === 'Ahorro').reduce((s, t) => s + Number(t.monto), 0)
  const gastos = trs.filter((t) => t.tipo === 'gasto' && t.categoria !== 'Ahorro').reduce((s, t) => s + Number(t.monto), 0)
  const ahorroPlaneado = (cats ?? []).filter((c) => c.grupo === 'Ahorro').reduce((s, c) => s + Number(c.monto_planeado), 0)
  const protegido = ingresos > 0 ? Math.min(ingresos, Math.max(ahorroPlaneado, ahorroGastado)) : ahorroGastado
  return ingresos - protegido - gastos
}
