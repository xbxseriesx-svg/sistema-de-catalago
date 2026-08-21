import { useEffect, useState } from "react";
import { LogIn, LogOut, X } from "lucide-react";
import { getSessionState, signIn, signOut } from "../persistence";

const field = "w-full rounded-md border border-ed-border bg-ed-surface px-2.5 py-2 text-xs text-ed-ink outline-none focus:border-ed-accent";

type SessionState = {
  email?: string | null;
  role?: string;
  error?: string;
};

export function SessionControl() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SessionState>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const session = await getSessionState();
      setState({
        email: session.session?.user.email ?? null,
        role: session.membership?.role ?? "",
      });
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "API indisponível" });
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (state.error) {
    return <span className="text-[10px] text-red-400" title={state.error}>API indisponível</span>;
  }

  if (state.email) return (
    <button
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-ed-border px-2 text-[11px] text-ed-muted hover:text-ed-ink"
      onClick={async () => { await signOut(); await refresh(); }}
      title={`${state.email} · ${state.role || "acesso ativo"}`}
    >
      <LogOut size={13}/> Sair
    </button>
  );

  return <>
    <button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-ed-border px-2 text-[11px] text-ed-muted hover:text-ed-ink" onClick={() => setOpen(true)}>
      <LogIn size={13}/> Entrar
    </button>
    {open && (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60" onMouseDown={() => setOpen(false)}>
        <div className="w-[360px] rounded-xl border border-ed-border bg-ed-panel p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <b className="text-sm text-ed-ink">Entrar no ASTERYON</b>
            <button onClick={() => setOpen(false)}><X size={16}/></button>
          </div>
          <div className="grid gap-2">
            <input className={field} type="email" placeholder="E-mail" value={email} onChange={(event) => setEmail(event.target.value)}/>
            <input className={field} type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)}/>
            <button
              className="rounded-md bg-ed-accent px-3 py-2 text-xs font-semibold text-white"
              onClick={async () => {
                setMessage("");
                try {
                  await signIn(email, password);
                  await refresh();
                  setOpen(false);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Falha ao autenticar");
                }
              }}
            >Entrar</button>
            {message && <p className="text-[11px] text-red-400">{message}</p>}
            <p className="text-[10px] text-ed-muted">Novos acessos são criados e ativados pelo administrador do sistema.</p>
          </div>
        </div>
      </div>
    )}
  </>;
}
