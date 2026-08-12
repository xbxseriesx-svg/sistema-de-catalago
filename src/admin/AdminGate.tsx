import React, { useEffect, useState } from 'react'
import { LockKeyhole, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { AsteryonMark } from '../components/AsteryonMark'
import { hasSupabase, supabase } from '../lib/supabase'

const LOCAL_SESSION_KEY = 'asteryon_admin_demo_session'

type AdminGateProps = { children: React.ReactNode }

export function AdminGate({ children }: AdminGateProps) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('admin@empresa.com.br')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      setAuthenticated(localStorage.getItem(LOCAL_SESSION_KEY) === '1')
      setReady(true)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session))
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)))
    return () => data.subscription.unsubscribe()
  }, [])

  const login = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (hasSupabase && supabase) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      } else {
        if (email !== 'admin@empresa.com.br' || password !== 'admin123') throw new Error('Credenciais inválidas no modo local.')
        localStorage.setItem(LOCAL_SESSION_KEY, '1')
        setAuthenticated(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (hasSupabase && supabase) await supabase.auth.signOut()
    localStorage.removeItem(LOCAL_SESSION_KEY)
    setAuthenticated(false)
  }

  if (!ready) return <div className="admin-auth-loading"><AsteryonMark size={42} /><span>Validando sessão administrativa…</span></div>

  if (!authenticated) return <div className="admin-auth-page"><form className="admin-auth-card" onSubmit={login}><div className="admin-auth-brand"><AsteryonMark size={48} /><div><strong>ASTERYON</strong><span>ADMINISTRAÇÃO</span></div></div><div className="admin-auth-title"><ShieldCheck size={22} /><div><h1>Acesso administrativo</h1><p>O Editor Visual e os rascunhos são restritos a usuários autenticados.</p></div></div><label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error ? <div className="admin-auth-error">{error}</div> : null}<button type="submit" disabled={loading}><LogIn size={17} />{loading ? 'Entrando…' : 'Entrar'}</button>{!hasSupabase ? <small><LockKeyhole size={13} /> Modo local: admin@empresa.com.br / admin123. Em produção, configure o Supabase Auth.</small> : null}</form></div>

  return <div className="admin-authenticated"><button className="admin-floating-logout" onClick={logout} title="Sair do painel"><LogOut size={16} /><span>Sair</span></button>{children}</div>
}
