import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Hoja from '../ui/Hoja'
import { lempiras, numero, pagosHechos } from './base'
import { hoyISO } from '../fechas'

function diasRestantes(fechaObjetivo) {
  if (!fechaObjetivo) return null
  const hoy = new Date(hoyISO() + 'T00:00:00')
  const meta = new Date(fechaObjetivo + 'T00:00:00')
  return Math.round((meta - hoy) / (1000 * 60 * 60 * 24))
}


const FORM_VACIO = { tipo: 'meta', nombre: '', objetivo: '', fecha: '', cuota: '', totalPagos: '', pagosPrevios: '' }

export default function PopupMetas({ metas, onGuardarMeta, onEliminarMeta, onAbonar, onPagarCuota, onCerrar }) {
  const [vista, setVista] = useState('lista') // lista | form | abonar
  const [form, setForm] = useState(FORM_VACIO)
  const [editando, setEditando] = useState(null)
  const [abonando, setAbonando] = useState(null)
  const [montoAbono, setMontoAbono] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const lista = metas.filter((m) => m.tipo !== 'deuda')
  const deudas = metas.filter((m) => m.tipo === 'deuda')

  function campo(nombre, valor) {
    setForm({ ...form, [nombre]: valor })
    setError('')
  }

  function nueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    setVista('form')
  }

  function editar(m) {
    setEditando(m)
    setForm({
      tipo: m.tipo || 'meta',
      nombre: m.nombre,
      objetivo: String(m.valor_objetivo ?? ''),
      fecha: m.fecha_objetivo || '',
      cuota: String(m.cuota_mensual ?? ''),
      totalPagos: String(m.total_pagos ?? ''),
      pagosPrevios: '',
    })
    setVista('form')
  }

  async function guardarForm(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Ponle un nombre'); return }
    let datos
    if (form.tipo === 'meta') {
      const objetivo = Number(form.objetivo)
      if (!objetivo || objetivo <= 0) { setError('El objetivo debe ser mayor a 0'); return }
      datos = { tipo: 'meta', nombre: form.nombre.trim(), valor_objetivo: objetivo, fecha_objetivo: form.fecha || null }
    } else {
      const cuota = Number(form.cuota)
      const total = parseInt(form.totalPagos, 10)
      if (!cuota || cuota <= 0) { setError('La cuota debe ser mayor a 0'); return }
      if (!total || total <= 0) { setError('¿Cuántos pagos son en total?'); return }
      datos = {
        tipo: 'deuda', nombre: form.nombre.trim(), cuota_mensual: cuota, total_pagos: total,
        valor_objetivo: cuota * total, fecha_objetivo: form.fecha || null,
      }
      if (!editando) {
        const previos = Math.min(total, parseInt(form.pagosPrevios, 10) || 0)
        datos.valor_actual = previos * cuota
        datos.completada = previos >= total
      }
    }
    setOcupado(true)
    const ok = await onGuardarMeta(datos, editando)
    setOcupado(false)
    if (ok) setVista('lista')
  }

  async function eliminar(m) {
    if (!confirm(`¿Eliminar "${m.nombre}"? Los movimientos ya registrados se conservan.`)) return
    await onEliminarMeta(m)
  }

  function abrirAbono(m) {
    setAbonando(m)
    setMontoAbono('')
    setError('')
    setVista('abonar')
  }

  async function guardarAbono(e) {
    e.preventDefault()
    const valor = Number(montoAbono)
    if (!valor || valor <= 0) { setError('Escribe un monto mayor a 0'); return }
    setOcupado(true)
    const ok = await onAbonar(abonando, valor)
    setOcupado(false)
    if (ok) setVista('lista')
  }

  async function pagarCuota(d) {
    setOcupado(true)
    await onPagarCuota(d)
    setOcupado(false)
  }

  if (vista === 'form') {
    return (
      <Hoja titulo={editando ? 'Editar' : 'Nueva'} onCerrar={onCerrar}>
        <form onSubmit={guardarForm} className="form-hoja">
          {!editando && (
            <div className="segmentado">
              <button type="button" className={form.tipo === 'meta' ? 'activo' : ''} onClick={() => campo('tipo', 'meta')}>Meta</button>
              <button type="button" className={form.tipo === 'deuda' ? 'activo' : ''} onClick={() => campo('tipo', 'deuda')}>Deuda</button>
            </div>
          )}
          <label className="campo">
            <span>Nombre</span>
            <input value={form.nombre} onChange={(e) => campo('nombre', e.target.value)}
              placeholder={form.tipo === 'meta' ? 'Fondo de emergencia' : 'Deuda TV'} autoFocus />
          </label>

          {form.tipo === 'meta' ? (
            <>
              <label className="campo">
                <span>Objetivo (L.)</span>
                <input inputMode="decimal" value={form.objetivo} placeholder="20000"
                  onChange={(e) => campo('objetivo', e.target.value.replace(/[^0-9.]/g, ''))} />
              </label>
              <label className="campo">
                <span>Fecha objetivo (opcional)</span>
                <input type="date" value={form.fecha} onChange={(e) => campo('fecha', e.target.value)} />
              </label>
            </>
          ) : (
            <>
              <div className="fila-campos">
                <label className="campo">
                  <span>Cuota mensual (L.)</span>
                  <input inputMode="decimal" value={form.cuota} placeholder="1600"
                    onChange={(e) => campo('cuota', e.target.value.replace(/[^0-9.]/g, ''))} />
                </label>
                <label className="campo">
                  <span>Pagos en total</span>
                  <input inputMode="numeric" value={form.totalPagos} placeholder="6"
                    onChange={(e) => campo('totalPagos', e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
              </div>
              {!editando && (
                <label className="campo">
                  <span>Pagos que ya hiciste</span>
                  <input inputMode="numeric" value={form.pagosPrevios} placeholder="0"
                    onChange={(e) => campo('pagosPrevios', e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
              )}
            </>
          )}

          {error && <p className="error-inline">{error}</p>}
          <div className="fila-botones">
            <button type="button" className="boton-secundario" onClick={() => setVista('lista')}>Volver</button>
            <button type="submit" className="boton-grande" disabled={ocupado}>Guardar</button>
          </div>
        </form>
      </Hoja>
    )
  }

  if (vista === 'abonar') {
    const falta = Number(abonando.valor_objetivo) - Number(abonando.valor_actual)
    return (
      <Hoja titulo={`Abonar a ${abonando.nombre}`} onCerrar={onCerrar}>
        <form onSubmit={guardarAbono} className="form-hoja">
          <label className="agregar-monto">
            <span>L.</span>
            <input inputMode="decimal" placeholder="0" value={montoAbono} autoFocus aria-label="Monto del abono"
              onChange={(e) => { setMontoAbono(e.target.value.replace(/[^0-9.]/g, '')); setError('') }} />
          </label>
          <p className="texto-suave centrado">
            Te faltan {lempiras(Math.max(0, falta))}. Se registra como Ahorro de este mes.
          </p>
          {error && <p className="error-inline">{error}</p>}
          <div className="fila-botones">
            <button type="button" className="boton-secundario" onClick={() => setVista('lista')}>Volver</button>
            <button type="submit" className="boton-grande" disabled={ocupado}>Abonar</button>
          </div>
        </form>
      </Hoja>
    )
  }

  return (
    <Hoja titulo="Metas" onCerrar={onCerrar}>
      <div className="metas-pop">
        <button className="link-violeta" onClick={nueva}><Plus size={16} /> Nueva meta o deuda</button>

        {lista.length === 0 && deudas.length === 0 && (
          <p className="vacio">Crea tu primera meta: un fondo de emergencia, una compra o tu Deuda TV.</p>
        )}

        {lista.map((m) => {
          const pct = Math.min(100, Math.round((Number(m.valor_actual) / Number(m.valor_objetivo)) * 100) || 0)
          const dias = diasRestantes(m.fecha_objetivo)
          return (
            <div key={m.id} className={`meta-item ${m.completada ? 'hecho' : ''}`}>
              <div className="meta-item-top">
                <span className="meta-item-nombre">{m.nombre}</span>
                <div className="acciones-icono">
                  <button onClick={() => editar(m)} aria-label="Editar"><Pencil size={15} /></button>
                  <button onClick={() => eliminar(m)} aria-label="Eliminar"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="barra-con-pct">
                <div className="barra-progreso">
                  <div className={`barra-relleno ${m.completada ? 'barra-completa' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <span>{pct}%</span>
              </div>
              <div className="meta-item-bottom">
                <span className="texto-suave">
                  {lempiras(m.valor_actual)} / {numero(m.valor_objetivo)}
                  {dias !== null && (dias >= 0 ? ` · ${dias} días` : ` · venció hace ${Math.abs(dias)} días`)}
                </span>
                {m.completada
                  ? <span className="chip-logrado">Lograda</span>
                  : <button className="boton-lila" onClick={() => abrirAbono(m)}>+ Abonar</button>}
              </div>
            </div>
          )
        })}

        {deudas.map((d) => {
          const hechos = pagosHechos(d)
          const total = d.total_pagos || 0
          return (
            <div key={d.id} className={`meta-item deuda ${d.completada ? 'hecho' : ''}`}>
              <div className="meta-item-top">
                <span className="meta-item-nombre">{d.nombre}</span>
                <div className="acciones-icono">
                  <span className="texto-suave">{lempiras(d.cuota_mensual)} / mes</span>
                  <button onClick={() => editar(d)} aria-label="Editar"><Pencil size={15} /></button>
                  <button onClick={() => eliminar(d)} aria-label="Eliminar"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="segmentos">
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={i < hechos ? 'lleno' : ''} />
                ))}
              </div>
              <div className="meta-item-bottom">
                <span className="texto-suave">
                  {d.completada ? '¡Deuda pagada!' : `Pago ${hechos} de ${total} · faltan ${lempiras((total - hechos) * d.cuota_mensual)}`}
                </span>
                {!d.completada && (
                  <button className="boton-vino-chico" onClick={() => pagarCuota(d)} disabled={ocupado}>Pagar cuota</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Hoja>
  )
}
