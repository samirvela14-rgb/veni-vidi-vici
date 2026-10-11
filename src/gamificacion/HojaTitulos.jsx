import { useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../supabaseClient'
import Hoja from '../ui/Hoja'
import { TITULOS, tituloPorNivel } from '../xp'
import { usuarioId } from './economia'

export default function HojaTitulos({ nivel, ajustes, desbloqueado, onCambio, onIrATienda, onCerrar }) {
  const [texto, setTexto] = useState(ajustes.titulo_personalizado || '')
  const [guardado, setGuardado] = useState(false)
  const actual = tituloPorNivel(nivel)

  async function guardar(e) {
    e.preventDefault()
    const { error } = await supabase.from('ajustes_jugador').upsert({
      user_id: await usuarioId(), titulo_personalizado: texto.trim() || null, actualizado_en: new Date().toISOString(),
    })
    if (error) { alert(error.message); return }
    setGuardado(true)
    await onCambio()
  }

  return (
    <Hoja titulo="Títulos" onCerrar={onCerrar}>
      <div className="titulos">
        <ul>
          {TITULOS.map((t, i) => {
            const siguiente = TITULOS[i + 1]
            const rango = siguiente ? `Nivel ${t.nivelMin}–${siguiente.nivelMin - 1}` : `Nivel ${t.nivelMin}+`
            const alcanzado = nivel >= t.nivelMin
            return (
              <li key={t.nombre} className={`${t.nombre === actual ? 'actual' : ''} ${alcanzado ? '' : 'bloqueado'}`}>
                <span className="titulo-nombre">{t.nombre}</span>
                <span className="texto-suave">{rango}</span>
                {t.nombre === actual && <span className="chip-logrado"><Check size={12} /> Actual</span>}
              </li>
            )
          })}
        </ul>

        <section className="titulo-personal">
          <span className="etiqueta-grupo">🖋️ Título personalizado</span>
          {desbloqueado ? (
            <form onSubmit={guardar} className="tienda-nuevo">
              <input value={texto} maxLength={32} placeholder="El Imparable, Señor de las Metas…"
                onChange={(e) => { setTexto(e.target.value); setGuardado(false) }} />
              <button className="boton-lila" type="submit">{guardado ? 'Guardado' : 'Guardar'}</button>
            </form>
          ) : (
            <p className="texto-suave">
              Escribe tu propio título para que aparezca junto a tu nivel.{' '}
              <button className="link-violeta" onClick={onIrATienda}>Desbloquéalo en la Tienda (60 🪙)</button>
            </p>
          )}
        </section>
      </div>
    </Hoja>
  )
}
