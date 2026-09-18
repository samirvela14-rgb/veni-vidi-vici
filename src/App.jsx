import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Dashboard from './Dashboard'
import HabitosYJournal from './HabitosYJournal'
import ProyectosYMetas from './ProyectosYMetas'
import Tareas from './Tareas'
import Finanzas from './Finanzas'
import Jarvis from './Jarvis'
import './App.css'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'habitos', label: 'Hábitos' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'jarvis', label: 'Jarvis' },
]

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <p>Cargando...</p>
  if (!session) return <Login />

  return (
    <div className="app">
      <nav className="app-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'activo' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="btn-salir-nav" onClick={() => supabase.auth.signOut()}>Salir</button>
      </nav>

      <div className="app-content">
        <main className="app-main">
          {tab === 'dashboard' && <Dashboard irA={setTab} />}
          {tab === 'habitos' && <HabitosYJournal />}
          {tab === 'proyectos' && <ProyectosYMetas />}
          {tab === 'tareas' && <Tareas />}
          {tab === 'finanzas' && <Finanzas />}
          {tab === 'jarvis' && <Jarvis />}
        </main>
      </div>
    </div>
  )
}

export default App