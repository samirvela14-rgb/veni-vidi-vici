import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'progreso', label: 'En Progreso' },
  { id: 'terminado', label: 'Terminado' },
]

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [etapasTotal, setEtapasTotal] = useState(1)

  async function cargar() {
    const { data } = await supabase
      .from('proyectos')
      .select('*')
      .order('creado_en', { ascending: false })
    setProyectos(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('proyectos').insert({
      nombre, etiqueta, etapas_total: etapasTotal, etapas_hechas: 0, user_id: user.id,
    })
    if (error) { alert(error.message); return }
    setNombre(''); setEtiqueta(''); setEtapasTotal(1); setMostrarForm(false)
    cargar()
  }

  async function moverEstado(p, nuevoEstado) {
    await supabase.from('proyectos').update({ estado: nuevoEstado }).eq('id', p.id)
    cargar()
  }

  async function avanzarEtapa(p) {
    const hechas = Math.min(p.etapas_total, p.etapas_hechas + 1)
    await supabase.from('proyectos').update({ etapas_hechas: hechas }).eq('id', p.id)
    cargar()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este proyecto?')) return
    await supabase.from('proyectos').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="seccion">
      {ESTADOS.map((estado) => {
        const items = proyectos.filter((p) => p.estado === estado.id)
        return (
          <div key={estado.id} className="kanban-columna">
            <div className="kanban-titulo">{estado.label} <span>{items.length}</span></div>
            {items.map((p) => (
              <div key={p.id} className="kanban-card">
                <div className="kanban-card-header">
                  {p.etiqueta && <span className="chip-etiqueta">{p.etiqueta}</span>}
                  <button className="btn-eliminar-habito" onClick={() => eliminar(p.id)}>✕</button>
                </div>
                <strong>{p.nombre}</strong>
                <span className="fecha">{p.etapas_hechas} / {p.etapas_total} etapas</span>
                <div className="fila">
                  {p.etapas_hechas < p.etapas_total && (
                    <button className="chip-btn" onClick={() => avanzarEtapa(p)}>+ etapa</button>
                  )}
                  {ESTADOS.filter((e) => e.id !== estado.id).map((e) => (
                    <button key={e.id} className="chip-btn" onClick={() => moverEstado(p, e.id)}>
                      → {e.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="vacio">Nada aquí.</p>}
          </div>
        )
      })}

      {!mostrarForm ? (
        <button className="boton-grande" onClick={() => setMostrarForm(true)}>+ Nuevo proyecto</button>
      ) : (
        <form onSubmit={agregar} className="form-rapido form-columna">
          <input placeholder="Nombre del proyecto" value={nombre}
            onChange={(e) => setNombre(e.target.value)} />
          <div className="fila">
            <input placeholder="Etiqueta (ej. DISEÑO)" value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)} />
            <input type="number" min="1" placeholder="# etapas" value={etapasTotal}
              onChange={(e) => setEtapasTotal(Number(e.target.value))} />
          </div>
          <div className="fila">
            <button type="submit">Crear</button>
            <button type="button" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}