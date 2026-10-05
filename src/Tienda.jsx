import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { ajustarXP } from './xp'

export default function Tienda() {
  const [recompensas, setRecompensas] = useState([])
  const [xpActual, setXpActual] = useState(0)
  const [nombre, setNombre] = useState('')
  const [costo, setCosto] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: rec }, { data: perfil }] = await Promise.all([
      supabase.from('recompensas').select('*').order('costo_xp', { ascending: true }),
      supabase.from('perfil').select('xp').eq('user_id', user.id).maybeSingle(),
    ])
    setRecompensas(rec || [])
    setXpActual(perfil?.xp || 0)
  }

  useEffect(() => { cargar() }, [])

  async function crear(e) {
    e.preventDefault()
    if (!nombre.trim() || !costo) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('recompensas').insert({
      nombre, costo_xp: Number(costo), user_id: user.id,
    })
    setNombre(''); setCosto(''); setMostrarForm(false)
    cargar()
  }

  async function canjear(r) {
    if (xpActual < r.costo_xp) return
    if (!confirm(`¿Canjear "${r.nombre}" por ${r.costo_xp} XP?`)) return
    await ajustarXP(-r.costo_xp)
    await supabase.from('recompensas').update({ veces_canjeada: r.veces_canjeada + 1 }).eq('id', r.id)
    cargar()
  }

  async function eliminar(id) {
    await supabase.from('recompensas').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="seccion">
      <div className="xp-detalle" style={{ textAlign: 'center' }}>Tienes {xpActual} XP</div>

      <div className="tienda-lista">
        {recompensas.map((r) => (
          <div key={r.id} className="tienda-card">
            <div>
              <strong>{r.nombre}</strong>
              <div className="detalle">{r.costo_xp} XP {r.veces_canjeada > 0 && `· canjeada ${r.veces_canjeada}x`}</div>
            </div>
            <div className="fila">
              <button
                className="chip-btn"
                onClick={() => canjear(r)}
                disabled={xpActual < r.costo_xp}
              >
                Canjear
              </button>
              <button className="btn-eliminar-habito" onClick={() => eliminar(r.id)}>✕</button>
            </div>
          </div>
        ))}
        {recompensas.length === 0 && <p className="vacio">Aún no has creado recompensas.</p>}
      </div>

      {!mostrarForm ? (
        <button className="boton-grande" onClick={() => setMostrarForm(true)}>+ Nueva recompensa</button>
      ) : (
        <form onSubmit={crear} className="form-rapido form-columna">
          <input placeholder="Recompensa (ej. Tarde de videojuegos)" value={nombre}
            onChange={(e) => setNombre(e.target.value)} />
          <input type="number" placeholder="Costo en XP" value={costo}
            onChange={(e) => setCosto(e.target.value)} />
          <div className="fila">
            <button type="submit">Crear</button>
            <button type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}