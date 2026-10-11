import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, Sparkles, Award, Store, GraduationCap, Target, X } from 'lucide-react'
import { supabase } from './supabaseClient'
import { hoyISO, sumarDias } from './fechas'
import { tituloPorNivel, dobleXPHasta } from './xp'
import RadarFacetado from './RadarFacetado'
import { traerDatosJuego } from './gamificacion/datos'
import { calcularSaldo, asegurarPremios } from './gamificacion/economia'
import { revisarLogros, evaluarLogros, RAREZAS } from './gamificacion/logros'
import { objetivosDeLaSemana } from './gamificacion/objetivos'
import { aplicarProtectores } from './gamificacion/dias'
import { revisarBonoFinanzas } from './gamificacion/bonoFinanzas'
import HojaTienda from './gamificacion/HojaTienda'
import HojaLogros from './gamificacion/HojaLogros'
import HojaTitulos from './gamificacion/HojaTitulos'
import HojaObjetivos from './gamificacion/HojaObjetivos'
import './gamificacion/gamificacion.css'

function calcularSaludo() {
  const ahora = new Date()
  const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes()
  const inicioBuenDia = 4 * 60 + 50   // 4:50am
  const finBuenDia = 19 * 60          // 7:00pm (exclusivo)
  const esBuenDia = minutosDelDia >= inicioBuenDia && minutosDelDia < finBuenDia
  return esBuenDia ? 'Buen día' : 'Linda noche'
}

async function traerRadar() {
  const hace7 = sumarDias(hoyISO(), -7)
  const [habitos, registros7d, journal7d] = await Promise.all([
    supabase.from('habitos').select('id').eq('activo', true),
    supabase.from('habito_registros').select('fecha').gte('fecha', hace7),
    supabase.from('journal_entradas').select('puntaje_ia').gte('fecha', hace7).not('puntaje_ia', 'is', null),
  ])
  const totalHabitos = habitos.data?.length || 0
  const posibles = totalHabitos * 7
  const scoreDisciplina = posibles ? Math.round(((registros7d.data?.length || 0) / posibles) * 100) : 0
  const puntajes = journal7d.data?.map((j) => j.puntaje_ia) || []
  const scoreMental = puntajes.length
    ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 10)
    : 0
  return { scoreDisciplina, scoreMental }
}

// Revisa todo lo que pasa "solo" (protectores, bono de finanzas, logros) y arma el estado del juego
async function cargarJuego() {
  await asegurarPremios()
  const [protegidas, bono] = await Promise.all([aplicarProtectores(), revisarBonoFinanzas()])
  let d = await traerDatosJuego()
  const { nuevos, cambios } = await revisarLogros(d)
  if (cambios || protegidas.length || bono) d = await traerDatosJuego()

  const avisos = [
    ...nuevos.map((l) => `${RAREZAS[l.rareza].emoji} Nuevo logro: ${l.titulo} · +${RAREZAS[l.rareza].monedas} 🪙`),
    ...(bono ? [`💸 Cerraste el mes cumpliendo tus reglas · +300 XP`] : []),
    ...protegidas.map(() => '🛡️ Se usó un protector: tu racha sigue viva'),
  ]
  return {
    d,
    logros: evaluarLogros(d),
    objetivos: objetivosDeLaSemana(d),
    saldo: calcularSaldo({ xp: d.perfil.xp, bonos: d.bonos, compras: d.compras }).saldo,
    // Cuánto le queda al Doble XP (se calcula al cargar, no al dibujar)
    dobleRestante: Math.max(0, (await dobleXPHasta()) - Date.now()),
    avisos,
  }
}

export default function Dashboard({ irA }) {
  const [radar, setRadar] = useState(null)
  const [juego, setJuego] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [hoja, setHoja] = useState(null) // tienda | logros | titulos | objetivos

  useEffect(() => {
    let vigente = true
    traerRadar().then((r) => { if (vigente) setRadar(r) })
    cargarJuego().then((j) => { if (vigente) { setJuego(j); setAvisos(j.avisos) } })
      .catch(() => { if (vigente) setJuego(null) })
    return () => { vigente = false }
  }, [])

  // Después de comprar o cobrar algo: recarga monedas, logros y objetivos
  const recargarJuego = useCallback(async () => {
    const j = await cargarJuego()
    setJuego(j)
    if (j.avisos.length) setAvisos((prev) => [...prev, ...j.avisos])
  }, [])

  if (!radar) return <p className="vacio">Cargando...</p>

  const { scoreDisciplina, scoreMental } = radar
  const categorias = [
    { categoria: 'Físico', valor: 0 },
    { categoria: 'Mental', valor: scoreMental },
    { categoria: 'Productividad', valor: 0 },
    { categoria: 'Financiero', valor: 0 },
    { categoria: 'Disciplina', valor: scoreDisciplina },
  ]

  const xp = juego?.d.perfil.xp || 0
  const nivel = juego?.d.perfil.nivel || 1
  const xpDelNivel = xp % 200
  const pctNivel = Math.round((xpDelNivel / 200) * 100)
  const tieneTitulo = juego?.d.compras.some((c) => c.clave === 'titulo')
  const titulo = (tieneTitulo && juego?.d.ajustes.titulo_personalizado) || tituloPorNivel(nivel)
  const fondo = juego?.d.compras.some((c) => c.clave === 'fondo') && juego?.d.ajustes.fondo_dashboard
  const dobleActivo = juego?.dobleRestante > 0
  const horasDoble = dobleActivo ? Math.max(1, Math.ceil(juego.dobleRestante / 3600000)) : 0
  const objetivosHechos = juego?.objetivos.filter((o) => o.cumplido).length || 0
  const porCobrar = juego?.objetivos.some((o) => o.cumplido && !o.cobrado)
  const logrosTengo = juego?.logros.filter((l) => l.desbloqueado).length || 0

  return (
    <div className="dashboard-flow" style={fondo ? { backgroundImage: `url("${fondo}")` } : undefined}>
      <div className="dashboard-flow-top">
        <div className="dashboard-hero-content">
          <h1 className="dashboard-titulo-app">Veni, Vidi, Vici</h1>
          <h2 className="dashboard-saludo-grande">{calcularSaludo()}</h2>
        </div>
        {juego && (
          <button className="boton-objetivos" onClick={() => setHoja('objetivos')} aria-label="Objetivos de la semana">
            <Target size={15} /> {objetivosHechos}/{juego.objetivos.length}
            {porCobrar && <span className="punto-aviso" aria-label="Tienes monedas por cobrar" />}
          </button>
        )}
        <button className="boton-jarvis-esquina" onClick={() => irA('jarvis')}>
          Hablar con Jarvis
        </button>
      </div>

      <div className="dashboard-flow-bottom">
        <div className="gamif-glass">
          {avisos.length > 0 && (
            <div className="aviso-juego" role="status">
              <div>{avisos.map((a, i) => <span key={i}>{a}</span>)}</div>
              <button onClick={() => setAvisos([])} aria-label="Cerrar avisos"><X size={16} /></button>
            </div>
          )}

          <div className="radar-y-lvl">
            <div className="radar-contenedor">
              <RadarFacetado categorias={categorias} />
            </div>

            <div className="lvl-xp-bloque">
              <span className="lvl-texto">LVL {String(nivel).padStart(3, '0')}</span>
              <span className="lvl-titulo firma">{titulo}</span>
              <span className="xp-decorativo">
                <ArrowUp size={16} strokeWidth={3} />
                XP
                <Sparkles size={16} />
              </span>
              <div className="barra-nivel">
                <div className="barra-nivel-relleno" style={{ width: `${pctNivel}%` }} />
              </div>
              <span className="xp-detalle">{xpDelNivel} / 200 XP</span>
              {juego && (
                <div className="lvl-chips">
                  <button className="chip-monedas" onClick={() => setHoja('tienda')} aria-label="Abrir tienda">
                    🪙 {juego.saldo}
                  </button>
                  {dobleActivo && <span className="chip-doble">⚡ Doble XP · {horasDoble} h</span>}
                </div>
              )}
            </div>
          </div>

          <div className="gamif-botones">
            <button className="gamif-boton" onClick={() => setHoja('logros')} disabled={!juego}>
              <Award size={28} strokeWidth={1.5} />
              Logros
              {juego && <span className="gamif-conteo">{logrosTengo}/{juego.logros.length}</span>}
            </button>
            <button className="gamif-boton" onClick={() => setHoja('tienda')} disabled={!juego}>
              <Store size={28} strokeWidth={1.5} />
              Tienda
              {juego && <span className="gamif-conteo">{juego.saldo} 🪙</span>}
            </button>
            <button className="gamif-boton" onClick={() => setHoja('titulos')} disabled={!juego}>
              <GraduationCap size={28} strokeWidth={1.5} />
              Títulos
              <span className="gamif-conteo">{tituloPorNivel(nivel)}</span>
            </button>
          </div>
        </div>
      </div>

      {juego && hoja === 'tienda' && (
        <HojaTienda
          datos={juego.d}
          saldo={juego.saldo}
          dobleRestante={juego.dobleRestante}
          onCambio={recargarJuego}
          onAbrirTitulos={() => setHoja('titulos')}
          onCerrar={() => setHoja(null)}
        />
      )}
      {juego && hoja === 'logros' && <HojaLogros logros={juego.logros} onCerrar={() => setHoja(null)} />}
      {juego && hoja === 'titulos' && (
        <HojaTitulos
          nivel={nivel}
          ajustes={juego.d.ajustes}
          desbloqueado={tieneTitulo}
          onCambio={recargarJuego}
          onIrATienda={() => setHoja('tienda')}
          onCerrar={() => setHoja(null)}
        />
      )}
      {juego && hoja === 'objetivos' && (
        <HojaObjetivos objetivos={juego.objetivos} lunes={juego.d.lunes} onCambio={recargarJuego} onCerrar={() => setHoja(null)} />
      )}
    </div>
  )
}
