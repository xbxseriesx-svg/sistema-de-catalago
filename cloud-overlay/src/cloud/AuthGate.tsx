import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Cloud, KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { cloudApi, type CloudUser } from './api';

export function CloudAuthGate({ children }: { children: (user: CloudUser) => ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const status = await cloudApi.authStatus();
      setNeedsBootstrap(status.needsBootstrap);
      setUser(status.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao verificar sessão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (loading) return <FullScreenMessage title="Conectando ao ASTERYON D1" subtitle="Validando editor e sessão administrativa..." />;
  if (user) return <>{children(user)}</>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-600/15 text-blue-400"><ShieldCheck size={24} /></div>
            <div><div className="text-lg font-bold">ASTERYON</div><div className="text-xs text-zinc-500">Editor v2.1 · Cloudflare D1</div></div>
          </div>
        </div>
        <div className="p-6">
          {needsBootstrap ? <BootstrapForm onSuccess={refresh} /> : <LoginForm onSuccess={refresh} />}
          {error && <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>}
          <div className="mt-5 flex items-center gap-2 text-[10px] text-zinc-600"><Cloud size={12} /> O portal público nunca recebe alterações antes de Publicar.</div>
        </div>
      </div>
    </div>
  );
}

function BootstrapForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [token, setToken] = useState('');
  const [name, setName] = useState('SDM ASTERYON');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await cloudApi.bootstrap({ token, name, email, password }); await onSuccess(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha na ativação'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-3">
    <div><div className="mb-1 text-xs font-semibold text-zinc-300">Primeira ativação do SDM</div><div className="text-[11px] leading-relaxed text-zinc-500">Use o token de ativação criado no deploy. Depois do primeiro SDM, esta etapa é desativada.</div></div>
    <Input label="Token de ativação" value={token} onChange={setToken} icon={<KeyRound size={14} />} type="password" />
    <Input label="Nome" value={name} onChange={setName} />
    <Input label="E-mail" value={email} onChange={setEmail} type="email" />
    <Input label="Senha (mínimo 10 caracteres)" value={password} onChange={setPassword} type="password" />
    {error && <p className="text-xs text-red-300">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">{busy ? 'Ativando...' : 'Criar SDM e entrar'}</button>
  </form>;
}

function LoginForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { await cloudApi.login({ email, password }); await onSuccess(); } catch (err) { setError(err instanceof Error ? err.message : 'Falha no login'); } finally { setBusy(false); } };
  return <form onSubmit={submit} className="space-y-3">
    <div><div className="mb-1 text-xs font-semibold text-zinc-300">Entrar no Editor</div><div className="text-[11px] text-zinc-500">Acesso ao rascunho, modelos, catálogo e publicação.</div></div>
    <Input label="E-mail" value={email} onChange={setEmail} type="email" />
    <Input label="Senha" value={password} onChange={setPassword} type="password" />
    {error && <p className="text-xs text-red-300">{error}</p>}
    <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"><LogIn size={15} /> {busy ? 'Entrando...' : 'Entrar'}</button>
  </form>;
}

function Input({ label, value, onChange, type='text', icon }: { label: string; value: string; onChange: (v:string)=>void; type?: string; icon?: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium text-zinc-400">{label}</span><div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 focus-within:border-blue-500">{icon && <span className="mr-2 text-zinc-500">{icon}</span>}<input type={type} value={value} onChange={e=>onChange(e.target.value)} className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-700" /></div></label>;
}

function FullScreenMessage({ title, subtitle }: { title:string; subtitle:string }) { return <div className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-100"><div className="text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /><div className="font-semibold">{title}</div><div className="mt-1 text-xs text-zinc-500">{subtitle}</div></div></div>; }
