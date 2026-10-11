import { useState } from 'react'
import { Calendar, Trash2, X } from 'lucide-react'
import Hoja from '../ui/Hoja'
import { abrirCalendario } from '../ui/abrirCalendario'
import { TIPOS_META, textoDias } from './base'

// Crear (meta = null) o editar una meta
export default function HojaMeta({ meta, onGuardar, onEliminar, onCerrar }) {
  const [titulo, setTitulo] = useState(meta?.titulo || '')
  const [emoji, setEmoji] = useState(meta?.emoji || '🎯')
  const [tipo, setTipo] = useState(meta?.tipo || 'dinero')
  const [objetivo, setObjetivo] = useState(meta ? String(meta.valor_objetivo) : '')
  const [fecha, setFecha] = useState(meta?.fecha_objetivo || '')
  const [foto, setFoto] = useState(meta?.foto_url || '')
  const [fotoRota, setFotoRota] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Ponle un nombre a tu meta'); return }
    const valor = Number(objetivo)
    if (!valor || valor <= 0) { setError('El objetivo debe ser mayor a 0'); return }
    setGuardando(true)
    const ok = await onGuardar({
      titulo: titulo.trim(), emoji: emoji.trim() || '🎯', tipo, valor_objetivo: valor,
      fecha_objetivo: fecha || null, foto_url: foto.trim(),
    }, meta)
    setGuardando(false)
    if (ok) onCerrar()
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la meta "${meta.titulo}"?`)) return
    await onEliminar(meta)
    onCerrar()
  }

  return (
    <Hoja titulo={meta ? 'Editar meta' : 'Nueva meta'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="form-hoja">
        <div className="meta-form-titulo">
          <input className="meta-form-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="Emoji" />
          <textarea
            className="tarea-titulo-input"
            rows={1}
            placeholder="Comprar mi moto, correr 10K…"
            value={titulo}
            onChange={(e) => { setTitulo(e.target.value); setError('') }}
            autoFocus={!meta}
            aria-label="Nombre de la meta"
          />
        </div>

        <div className="segmentado">
          {TIPOS_META.map((t) => (
            <button type="button" key={t.id} className={tipo === t.id ? 'activo' : ''} onClick={() => setTipo(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="fila-campos">
          <label className="campo">
            <span>Objetivo {tipo === 'dinero' ? '(L.)' : tipo === 'porcentaje' ? '(%)' : ''}</span>
            <input inputMode="decimal" value={objetivo} placeholder={tipo === 'dinero' ? '20000' : '100'}
              onChange={(e) => { setObjetivo(e.target.value.replace(/[^0-9.]/g, '')); setError('') }} />
          </label>
          <div className="campo">
            <span>Fecha (opcional)</span>
            <div className="opciones">
              <label className={`opcion opcion-fecha ${fecha ? 'activo' : ''}`} onClick={abrirCalendario}>
                <Calendar size={14} />
                {fecha ? textoDias(fecha) : 'Elegir'}
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              {fecha && (
                <button type="button" className="opcion opcion-quitar" onClick={() => setFecha('')} aria-label="Quitar fecha"><X size={14} /></button>
              )}
            </div>
          </div>
        </div>

        <label className="campo">
          <span>Foto de fondo (link de imagen, opcional)</span>
          <input value={foto} placeholder="https://…" onChange={(e) => { setFoto(e.target.value); setFotoRota(false) }} />
        </label>
        {foto.trim() && (
          fotoRota
            ? <p className="texto-suave rojo">No se pudo cargar esa imagen. Prueba con otro link.</p>
            : <img className="meta-form-preview" src={foto.trim()} alt="" onError={() => setFotoRota(true)} />
        )}

        {error && <p className="error-inline">{error}</p>}
        <button type="submit" className="boton-grande" disabled={guardando}>
          {guardando ? 'Guardando...' : meta ? 'Guardar' : 'Crear meta'}
        </button>
        {meta && (
          <button type="button" className="boton-eliminar" onClick={eliminar}><Trash2 size={15} /> Eliminar meta</button>
        )}
      </form>
    </Hoja>
  )
}
