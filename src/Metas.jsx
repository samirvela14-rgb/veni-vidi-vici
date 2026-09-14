import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const SIMBOLO = { dinero: '$', numero: '', porcentaje: '%' }

export default function Metas() {
  const [metas, setMetas] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({
    titulo: '', emoji: '🎯', foto_url: '', tipo: 'dinero', valor_objetivo: '',
  })

  async function cargar() {
    const { data } = await supabase
      .from('metas')
      .select('*')
      .order('creado_en', { ascending: false })
    setMetas(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function crearMeta(e) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.valor_objetivo) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('metas').insert({
      ...form,
      valor_objetivo: Number(form.valor_objetivo),
      valor_actual: 0,
      user_id: user.id,
    })
    if (error) { alert(error.message); return }
    setForm({ titulo: '', emoji: '🎯', foto_url: '', tipo: 'dinero', valor_objetivo: '' })
    setMostrarForm(false)
    cargar()
  }

  const [edicionValores, setEdicionValores] = useState({})

function valorMostrado(meta) {
  return edicionValores[meta.id] ?? meta.valor_actual
}

function alEscribir(metaId, texto) {
  setEdicionValores({ ...edicionValores, [metaId]: texto })
}

async function alSalirDelCampo(meta) {
  const texto = edicionValores[meta.id]
  if (texto === undefined) return
  const nuevoValor = Number(texto) || 0
  const completada = nuevoValor >= meta.valor_objetivo
  await supabase.from('metas').update({
    valor_actual: nuevoValor, completada,
  }).eq('id', meta.id)
  const copia = { ...edicionValores }
  delete copia[meta.id]
  setEdicionValores(copia)
  cargar()
}

  async function eliminarMeta(id) {
    if (!confirm('¿Eliminar esta meta?')) return
    await supabase.from('metas').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="seccion">
      <div className="metas-grid">
        {metas.map((m) => {
          const pct = Math.min(100, Math.round((m.valor_actual / m.valor_objetivo) * 100))
          const falta = Math.max(0, m.valor_objetivo - m.valor_actual)
          return (
            <div key={m.id} className="meta-card">
              {m.foto_url && (
                <div
                  className="meta-foto"
                  style={{ backgroundImage: `url(${m.foto_url})` }}
                />
              )}
              <div className="meta-card-body">
                <div className="meta-card-header">
                  <span className="meta-emoji">{m.emoji}</span>
                  <button className="btn-eliminar-habito" onClick={() => eliminarMeta(m.id)}>✕</button>
                </div>
                <h3>{m.titulo}</h3>
                <span className="meta-objetivo-label">
                  Objetivo: {SIMBOLO[m.tipo]}{m.valor_objetivo.toLocaleString()}
                </span>

                <div className="meta-progreso-fila">
                  <span className="meta-progreso-label">PROGRESO</span>
                  <span className="meta-progreso-pct">{pct}%</span>
                </div>
                <div className="barra-progreso">
                  <div
                    className={`barra-relleno ${m.completada ? 'barra-completa' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="meta-falta">
                  {m.completada
                    ? '✓ ¡Meta completada!'
                    : `Faltan ${SIMBOLO[m.tipo]}${falta.toLocaleString()} para completar.`}
                </div>

                <input
                  type="number"
                  className="meta-input-valor"
                  value={valorMostrado(m)}
                  onChange={(e) => alEscribir(m.id, e.target.value)}
                  onBlur={() => alSalirDelCampo(m)}
                  placeholder="Actualizar progreso..."
                />
              </div>
            </div>
          )
        })}
      </div>

      {metas.length === 0 && <p className="vacio">Aún no tienes metas.</p>}

      {!mostrarForm ? (
        <button className="boton-grande" onClick={() => setMostrarForm(true)}>+ Nueva meta</button>
      ) : (
        <form onSubmit={crearMeta} className="form-rapido form-columna">
          <input
            placeholder="Título (ej. Comprar BMW M4)"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
          <div className="fila">
            <input
              placeholder="Emoji"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              style={{ flex: '0 0 60px' }}
            />
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="dinero">Dinero</option>
              <option value="numero">Número</option>
              <option value="porcentaje">Porcentaje</option>
            </select>
            <input
              type="number"
              placeholder="Objetivo"
              value={form.valor_objetivo}
              onChange={(e) => setForm({ ...form, valor_objetivo: e.target.value })}
            />
          </div>
          <input
            placeholder="Link de imagen (opcional)"
            value={form.foto_url}
            onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
          />
          <div className="fila">
            <button type="submit">Crear meta</button>
            <button type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}