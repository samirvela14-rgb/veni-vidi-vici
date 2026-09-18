import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function TarjetaDetalle({ tarjeta, onCerrar, onCambio }) {
  const [titulo, setTitulo] = useState(tarjeta.titulo)
  const [fechaLimite, setFechaLimite] = useState(tarjeta.fecha_limite || '')
  const [detalleExtra, setDetalleExtra] = useState(tarjeta.detalle_extra || '')
  const [checklist, setChecklist] = useState([])
  const [nuevoItem, setNuevoItem] = useState('')

  async function cargarChecklist() {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('tarjeta_id', tarjeta.id)
      .order('orden')
    setChecklist(data || [])
  }

  useEffect(() => { cargarChecklist() }, [tarjeta.id])

  async function guardar() {
    await supabase.from('tarjetas').update({
      titulo, fecha_limite: fechaLimite || null, detalle_extra: detalleExtra,
    }).eq('id', tarjeta.id)
    onCambio()
    onCerrar()
  }

  async function eliminarTarjeta() {
    if (!confirm('¿Eliminar esta tarjeta?')) return
    await supabase.from('tarjetas').delete().eq('id', tarjeta.id)
    onCambio()
    onCerrar()
  }

  async function agregarItem(e) {
    e.preventDefault()
    if (!nuevoItem.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const maxOrden = checklist.length ? Math.max(...checklist.map((i) => i.orden)) : 0
    await supabase.from('checklist_items').insert({
      texto: nuevoItem, tarjeta_id: tarjeta.id, user_id: user.id, orden: maxOrden + 1,
    })
    setNuevoItem('')
    cargarChecklist()
  }

  async function toggleItem(item) {
    await supabase.from('checklist_items').update({ hecho: !item.hecho }).eq('id', item.id)
    cargarChecklist()
  }

  async function eliminarItem(id) {
    await supabase.from('checklist_items').delete().eq('id', id)
    cargarChecklist()
  }

  const hechos = checklist.filter((i) => i.hecho).length

  return (
    <div className="tarjeta-overlay" onClick={onCerrar}>
      <div className="tarjeta-detalle" onClick={(e) => e.stopPropagation()}>
        <div className="tarjeta-detalle-header">
          <input
            className="tarjeta-detalle-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <button className="btn-volver" onClick={onCerrar}>✕</button>
        </div>

        <div className="journal-campo">
          <label>Fecha límite</label>
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
          />
        </div>

        <div className="journal-campo">
          <label>Detalles</label>
          <textarea
            rows={4}
            value={detalleExtra}
            onChange={(e) => setDetalleExtra(e.target.value)}
            placeholder="Notas, contexto, lo que necesites..."
          />
        </div>

        <div className="journal-campo">
          <label>Checklist {checklist.length > 0 && `(${hechos}/${checklist.length})`}</label>
          <div className="checklist-lista">
            {checklist.map((item) => (
              <div key={item.id} className="checklist-item">
                <label>
                  <input type="checkbox" checked={item.hecho} onChange={() => toggleItem(item)} />
                  <span className={item.hecho ? 'checklist-hecho' : ''}>{item.texto}</span>
                </label>
                <button className="btn-eliminar-habito" onClick={() => eliminarItem(item.id)}>✕</button>
              </div>
            ))}
          </div>
          <form onSubmit={agregarItem} className="form-rapido">
            <input
              placeholder="Nuevo ítem..."
              value={nuevoItem}
              onChange={(e) => setNuevoItem(e.target.value)}
            />
            <button type="submit">+</button>
          </form>
        </div>

        <div className="tarjeta-detalle-acciones">
          <button className="boton-grande" onClick={guardar}>Guardar</button>
          <button className="btn-eliminar-tarjeta" onClick={eliminarTarjeta}>Eliminar tarjeta</button>
        </div>
      </div>
    </div>
  )
}