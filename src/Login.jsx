import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-pantalla">
      <div className="login-card">
        <div className="login-marca">
          <span className="login-icono">⚔️</span>
          <h1>Veni, Vidi, Vici</h1>
          <p className="login-subtitulo">Tu sistema personal</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-campo">
            <label>Correo</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-campo">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-boton" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}