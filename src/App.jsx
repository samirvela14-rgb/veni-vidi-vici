import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Flame, BookOpen, FolderKanban, ListTodo, Wallet, Sparkles, LogOut } from 'lucide-react'
import { supabase } from './supabaseClient'
import Login from './Login'
import Dashboard from './Dashboard'
import HabitosYJournal from './HabitosYJournal'
import ProyectosYMetas from './ProyectosYMetas'
import Tareas from './Tareas'
import Finanzas from './Finanzas'
import Jarvis from './Jarvis'
import './App.css'
import './ui/ui.css'
import Palabra from './Palabra'
import EstadoConexion from './offline/EstadoConexion'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icono: LayoutDashboard },
  { id: 'habitos', label: 'Hábitos', Icono: Flame },
  { id: 'palabra', label: 'Palabra', Icono: BookOpen },
  { id: 'proyectos', label: 'Proyectos', Icono: FolderKanban },
  { id: 'tareas', label: 'Tareas', Icono: ListTodo },
  { id: 'finanzas', label: 'Finanzas', Icono: Wallet },
  { id: 'jarvis', label: 'Jarvis', Icono: Sparkles },
]

// Lee el enlace con el que se abrió la app y lo limpia de la barra de direcciones
function leerEnlace() {
  const params = new URLSearchParams(window.location.search)
  const agregar = ['gasto', 'ingreso'].includes(params.get('agregar')) ? params.get('agregar') : null
  const ir = TABS.some((t) => t.id === params.get('ir')) ? params.get('ir') : null
  if (agregar || ir) window.history.replaceState(null, '', '/')
  return { tab: agregar ? 'finanzas' : ir || 'dashboard', agregar }
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Enlaces directos: /?agregar=gasto|ingreso (accesos del ícono, botón del panel) y /?ir=tareas|jarvis (notificaciones)
  const [accion, setAccion] = useState(leerEnlace)
  const [tab, setTab] = useState(accion.tab)
  const navRef = useRef(null)
  // Al sincronizar cambios hechos sin internet, la pantalla se vuelve a montar con datos frescos
  const [version, setVersion] = useState(0)
  const recargarPantalla = useCallback(() => setVersion((v) => v + 1), [])

  // Celular: la barra se desliza; al cambiar de pestaña, la activa queda centrada
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) return
    navRef.current?.querySelector('button.activo')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [tab, session])

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
      <nav className="app-nav" ref={navRef}>
        {TABS.map(({ id, label, Icono }) => (
          <button
            key={id}
            className={tab === id ? 'activo' : ''}
            onClick={() => { setTab(id); setAccion((a) => ({ ...a, agregar: null })) }}
            aria-label={label}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icono size={20} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
        <button className="btn-salir-nav" onClick={() => supabase.auth.signOut()} aria-label="Salir">
          <LogOut size={19} strokeWidth={1.75} />
          <span>Salir</span>
        </button>
      </nav>

      <div className="app-content">
        <EstadoConexion onSincronizado={recargarPantalla} />
        <main className="app-main" key={version}>
          {tab === 'dashboard' && <Dashboard irA={setTab} />}
          {tab === 'habitos' && <HabitosYJournal />}
          {tab === 'palabra' && <Palabra />}
          {tab === 'proyectos' && <ProyectosYMetas />}
          {tab === 'tareas' && <Tareas />}
          {tab === 'finanzas' && <Finanzas agregarAlAbrir={accion.agregar} />}
          {tab === 'jarvis' && <Jarvis />}
        </main>
      </div>
    </div>
  )
}

export default App