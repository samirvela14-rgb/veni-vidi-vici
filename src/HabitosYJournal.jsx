import { useState } from 'react'
import Habitos from './Habitos'
import Journal from './Journal'

export default function HabitosYJournal() {
  const [subtab, setSubtab] = useState('habitos')

  return (
    <div className="seccion">
      <div className="subtabs">
        <button
          className={subtab === 'habitos' ? 'activo' : ''}
          onClick={() => setSubtab('habitos')}
        >
          Hábitos
        </button>
        <button
          className={subtab === 'journal' ? 'activo' : ''}
          onClick={() => setSubtab('journal')}
        >
          Journaling
        </button>
      </div>

      {subtab === 'habitos' ? <Habitos /> : <Journal />}
    </div>
  )
}