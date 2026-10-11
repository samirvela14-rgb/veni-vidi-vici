import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { hoyISO, sumarDias } from '../fechas'
import Hoja from '../ui/Hoja'
import { NIVELES, PODERES, XP_POR_MONEDA, precioDeNivel, registrarCompra, usuarioId } from './economia'
import { crearDiaPerfecto, habitosActivosEn } from './dias'

const lempiras = (n) => `L. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`

function horasRestantes(ms) {
  const h = Math.ceil(ms / 3600000)
  return h <= 1 ? 'menos de 1 h' : `${h} h`
}

export default function HojaTienda({ datos, saldo, dobleRestante, onCambio, onAbrirTitulos, onCerrar }) {
  const [vista, setVista] = useState('premios') // premios | poderes | historial
  const [editando, setEditando] = useState(false)
  const [detalle, setDetalle] = useState(null) // { tipo: 'premio' | 'poder', item }
  const [nuevoEn, setNuevoEn] = useState(null)
  const [nuevo, setNuevo] = useState({ emoji: '🎁', nombre: '', monto: '' })
  const [registrarGasto, setRegistrarGasto] = useState(true)
  const [fechaElegida, setFechaElegida] = useState(null)
  const [textoAjuste, setTextoAjuste] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [hecho, setHecho] = useState('')

  const compras = datos.compras
  const protectores = compras.filter((c) => c.clave === 'protector' && !c.usado_en).length
  const tiene = (clave) => compras.some((c) => c.clave === clave)
  const especiales = new Set(datos.especiales.map((e) => e.fecha))
  const hoy = hoyISO()

  // Días que se pueden revivir: ayer o anteayer, con hábitos, sin completar ni proteger
  const diaPerfecto = crearDiaPerfecto(datos.habitos, datos.registros, datos.especiales)
  const diasRotos = [sumarDias(hoy, -1), sumarDias(hoy, -2)]
    .filter((f) => !diaPerfecto(f) && habitosActivosEn(datos.habitos, f).length > 0)
  const diasDescanso = [hoy, sumarDias(hoy, 1)].filter((f) => !especiales.has(f))

  function abrir(tipo, item) {
    setDetalle({ tipo, item })
    setError('')
    setHecho('')
    setRegistrarGasto(true)
    setFechaElegida(null)
    setTextoAjuste(item.clave === 'titulo' ? (datos.ajustes.titulo_personalizado || '') : item.clave === 'fondo' ? (datos.ajustes.fondo_dashboard || '') : '')
  }

  async function canjearPremio(r) {
    const costo = r.costo_monedas || precioDeNivel(r.nivel)
    if (saldo < costo) { setError(`Te faltan ${costo - saldo} 🪙`); return }
    setOcupado(true)
    try {
      await registrarCompra({ tipo: 'real', clave: String(r.id), nombre: r.nombre, costo })
      await supabase.from('recompensas').update({ veces_canjeada: (r.veces_canjeada || 0) + 1 }).eq('id', r.id)
      if (r.monto_dinero && registrarGasto) {
        await supabase.from('transacciones').insert({
          tipo: 'gasto', monto: Number(r.monto_dinero), fecha: hoy, user_id: await usuarioId(),
          categoria: 'Entretenimiento', subcategoria: r.nombre, descripcion: 'Premio de la tienda',
        })
      }
      setHecho(`¡Disfrútalo! ${r.emoji} ${r.nombre}`)
      await onCambio()
    } catch (e) {
      setError(e.message)
    }
    setOcupado(false)
  }

  async function comprarPoder(p) {
    if (saldo < p.precio && !(p.unico && tiene(p.clave))) { setError(`Te faltan ${p.precio - saldo} 🪙`); return }
    setOcupado(true)
    try {
      if (p.clave === 'revivir' || p.clave === 'descanso') {
        if (!fechaElegida) { setError('Elige el día'); setOcupado(false); return }
        const { error: e } = await supabase.from('dias_especiales')
          .insert({ fecha: fechaElegida, tipo: p.clave === 'descanso' ? 'descanso' : 'protector' })
        if (e) throw e
        const compra = await registrarCompra({ tipo: 'app', clave: p.clave, nombre: p.nombre, costo: p.precio })
        await supabase.from('compras').update({ usado_en: new Date().toISOString() }).eq('id', compra.id)
        setHecho(p.clave === 'descanso' ? 'Día de descanso guardado 😴' : 'Racha recuperada ⏪')
      } else if (p.unico) {
        if (!tiene(p.clave)) await registrarCompra({ tipo: 'app', clave: p.clave, nombre: p.nombre, costo: p.precio })
        const campo = p.clave === 'titulo' ? 'titulo_personalizado' : 'fondo_dashboard'
        const { error: e } = await supabase.from('ajustes_jugador').upsert({
          user_id: await usuarioId(), [campo]: textoAjuste.trim() || null, actualizado_en: new Date().toISOString(),
        })
        if (e) throw e
        setHecho(p.clave === 'titulo' ? 'Título guardado 🖋️' : 'Fondo guardado 🖼️')
      } else {
        await registrarCompra({ tipo: 'app', clave: p.clave, nombre: p.nombre, costo: p.precio })
        setHecho(p.clave === 'doble_xp' ? '⚡ Doble XP activo por 24 horas' : '🛡️ Protector guardado')
      }
      await onCambio()
    } catch (e) {
      setError(e.message)
    }
    setOcupado(false)
  }

  async function agregarPremio(nivel) {
    if (!nuevo.nombre.trim()) return
    const { error: e } = await supabase.from('recompensas').insert({
      nivel, emoji: nuevo.emoji.trim() || '🎁', nombre: nuevo.nombre.trim(),
      monto_dinero: Number(nuevo.monto) || null, costo_monedas: precioDeNivel(nivel),
      costo_xp: 0, veces_canjeada: 0, user_id: await usuarioId(),
    })
    if (e) { alert(e.message); return }
    setNuevo({ emoji: '🎁', nombre: '', monto: '' })
    setNuevoEn(null)
    await onCambio()
  }

  async function borrarPremio(r) {
    if (!confirm(`¿Quitar "${r.nombre}" de la tienda?`)) return
    await supabase.from('recompensas').delete().eq('id', r.id)
    await onCambio()
  }

  // ---------- Detalle de un premio o poder ----------
  if (detalle) {
    const { tipo, item } = detalle
    const esPoder = tipo === 'poder'
    const costo = esPoder ? item.precio : (item.costo_monedas || precioDeNivel(item.nivel))
    const yaUnico = esPoder && item.unico && tiene(item.clave)
    const dobleActivo = item.clave === 'doble_xp' && dobleRestante > 0
    const sinDiasRevivir = item.clave === 'revivir' && diasRotos.length === 0
    const alcanza = saldo >= costo || yaUnico

    return (
      <Hoja titulo="" onCerrar={onCerrar}>
        <div className="tienda-detalle">
          <span className="tienda-detalle-emoji">{item.emoji}</span>
          <h2>{item.nombre}</h2>
          {esPoder && <p className="texto-suave centrado">{item.descripcion}</p>}
          {!yaUnico && <span className="tienda-precio grande">{costo} 🪙</span>}
          {!yaUnico && !hecho && (
            <span className={`texto-suave ${alcanza ? '' : 'rojo'}`}>
              {alcanza ? `Te quedarían ${saldo - costo} 🪙` : `Tienes ${saldo} 🪙 · te faltan ${costo - saldo}`}
            </span>
          )}

          {hecho ? (
            <>
              <p className="tienda-hecho">{hecho}</p>
              <button className="boton-grande" onClick={() => setDetalle(null)}>Volver a la tienda</button>
            </>
          ) : (
            <>
              {!esPoder && item.monto_dinero > 0 && (
                <label className="tienda-check">
                  <input type="checkbox" checked={registrarGasto} onChange={(e) => setRegistrarGasto(e.target.checked)} />
                  Registrar {lempiras(item.monto_dinero)} como gasto de Entretenimiento en Finanzas
                </label>
              )}

              {item.clave === 'revivir' && (sinDiasRevivir
                ? <p className="texto-suave centrado">No tienes rachas rotas en los últimos 2 días. ¡Bien!</p>
                : (
                  <div className="opciones centradas">
                    {diasRotos.map((f) => (
                      <button key={f} className={`opcion ${fechaElegida === f ? 'activo' : ''}`} onClick={() => setFechaElegida(f)}>
                        {f === sumarDias(hoy, -1) ? 'Ayer' : 'Anteayer'}
                      </button>
                    ))}
                  </div>
                ))}

              {item.clave === 'descanso' && (
                <div className="opciones centradas">
                  {diasDescanso.map((f) => (
                    <button key={f} className={`opcion ${fechaElegida === f ? 'activo' : ''}`} onClick={() => setFechaElegida(f)}>
                      {f === hoy ? 'Hoy' : 'Mañana'}
                    </button>
                  ))}
                  {diasDescanso.length === 0 && <p className="texto-suave">Hoy y mañana ya están protegidos.</p>}
                </div>
              )}

              {(item.clave === 'titulo' || item.clave === 'fondo') && (yaUnico || alcanza) && (
                <label className="campo tienda-ajuste">
                  <span>{item.clave === 'titulo' ? 'Tu título' : 'Link de la foto'}</span>
                  <input value={textoAjuste} onChange={(e) => setTextoAjuste(e.target.value)}
                    placeholder={item.clave === 'titulo' ? 'El Imparable, Señor de las Metas…' : 'https://…'}
                    maxLength={item.clave === 'titulo' ? 32 : 500} />
                </label>
              )}
              {item.clave === 'fondo' && textoAjuste.trim() && (
                <img className="meta-form-preview" src={textoAjuste.trim()} alt="" />
              )}

              {error && <p className="error-inline">{error}</p>}
              {dobleActivo ? (
                <p className="texto-suave centrado">Ya tienes Doble XP activo · quedan {horasRestantes(dobleRestante)}</p>
              ) : (
                <button
                  className="boton-grande"
                  disabled={ocupado || sinDiasRevivir || (item.clave === 'descanso' && diasDescanso.length === 0)}
                  onClick={() => (esPoder ? comprarPoder(item) : canjearPremio(item))}
                >
                  {ocupado ? 'Un momento…' : yaUnico ? 'Guardar' : esPoder ? `Comprar por ${costo} 🪙` : `Canjear por ${costo} 🪙`}
                </button>
              )}
              <button className="boton-secundario" onClick={() => setDetalle(null)}>Volver</button>
            </>
          )}
        </div>
      </Hoja>
    )
  }

  // ---------- Tienda ----------
  return (
    <Hoja titulo="Tienda" onCerrar={onCerrar}>
      <div className="tienda">
        <div className="tienda-saldo">
          <span className="tienda-saldo-num">{saldo} <span>🪙</span></span>
          <span className="texto-suave">1 moneda = {XP_POR_MONEDA} XP · gastar no baja tu nivel</span>
        </div>

        <div className="segmentado">
          <button className={vista === 'premios' ? 'activo' : ''} onClick={() => setVista('premios')}>Premios</button>
          <button className={vista === 'poderes' ? 'activo' : ''} onClick={() => setVista('poderes')}>Poderes</button>
          <button className={vista === 'historial' ? 'activo' : ''} onClick={() => setVista('historial')}>Historial</button>
        </div>

        {vista === 'premios' && (
          <>
            <button className="link-violeta tienda-editar" onClick={() => { setEditando(!editando); setNuevoEn(null) }}>
              <Pencil size={14} /> {editando ? 'Listo' : 'Editar premios'}
            </button>
            {NIVELES.map((n) => {
              const lista = datos.recompensas.filter((r) => (r.nivel || 'pequeno') === n.id)
              return (
                <section key={n.id} className="tienda-nivel">
                  <div className="tienda-nivel-header">
                    <span>{n.label}</span>
                    <span className="texto-suave">{n.precio} 🪙 · {n.ritmo}</span>
                  </div>
                  <ul>
                    {lista.map((r) => (
                      <li key={r.id}>
                        <button className="tienda-item" onClick={() => !editando && abrir('premio', r)} disabled={editando}>
                          <span className="tienda-item-emoji">{r.emoji || '🎁'}</span>
                          <span className="tienda-item-nombre">
                            {r.nombre}
                            {r.veces_canjeada > 0 && <span className="texto-suave"> · {r.veces_canjeada}×</span>}
                          </span>
                          {!editando && <span className={`tienda-precio ${saldo >= n.precio ? '' : 'caro'}`}>{n.precio} 🪙</span>}
                        </button>
                        {editando && (
                          <button className="borrar" onClick={() => borrarPremio(r)} aria-label={`Quitar ${r.nombre}`}><Trash2 size={15} /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {editando && (nuevoEn === n.id ? (
                    <div className="tienda-nuevo">
                      <input className="tienda-nuevo-emoji" value={nuevo.emoji} maxLength={4} aria-label="Emoji"
                        onChange={(e) => setNuevo({ ...nuevo, emoji: e.target.value })} />
                      <input placeholder="Premio" value={nuevo.nombre} autoFocus
                        onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
                      <input className="tienda-nuevo-monto" placeholder="L. (opcional)" inputMode="decimal" value={nuevo.monto}
                        onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value.replace(/[^0-9.]/g, '') })} />
                      <button className="boton-lila" onClick={() => agregarPremio(n.id)}>Agregar</button>
                    </div>
                  ) : (
                    <button className="link-violeta" onClick={() => { setNuevoEn(n.id); setNuevo({ emoji: '🎁', nombre: '', monto: '' }) }}>
                      <Plus size={14} /> Agregar premio {n.label.toLowerCase()}
                    </button>
                  ))}
                </section>
              )
            })}
          </>
        )}

        {vista === 'poderes' && (
          <ul className="tienda-poderes">
            {PODERES.map((p) => {
              const yaUnico = p.unico && tiene(p.clave)
              const activo = p.clave === 'doble_xp' && dobleRestante > 0
              return (
                <li key={p.clave}>
                  <button className="tienda-poder" onClick={() => (p.clave === 'titulo' && yaUnico ? onAbrirTitulos() : abrir('poder', p))}>
                    <span className="tienda-item-emoji">{p.emoji}</span>
                    <span className="tienda-poder-texto">
                      <span>{p.nombre}</span>
                      <span className="texto-suave">
                        {p.clave === 'protector' && protectores > 0 ? `Tienes ${protectores} guardado${protectores === 1 ? '' : 's'} · ` : ''}
                        {activo ? `Activo · quedan ${horasRestantes(dobleRestante)}` : p.descripcion}
                      </span>
                    </span>
                    {yaUnico
                      ? <span className="chip-logrado">Tuyo</span>
                      : <span className={`tienda-precio ${saldo >= p.precio ? '' : 'caro'}`}>{p.precio} 🪙</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {vista === 'historial' && (
          compras.length === 0
            ? <p className="vacio">Todavía no has canjeado nada. ¡Tu primer premio te espera!</p>
            : (
              <ul className="tienda-historial">
                {compras.slice(0, 40).map((c) => (
                  <li key={c.id}>
                    <span>{c.nombre}</span>
                    <span className="texto-suave">{new Date(c.creado_en).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}</span>
                    <span className="tienda-precio">-{c.costo} 🪙</span>
                  </li>
                ))}
              </ul>
            )
        )}
      </div>
    </Hoja>
  )
}
