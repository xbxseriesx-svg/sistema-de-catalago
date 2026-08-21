import { useEffect, useState } from "react";
import { getSessionState, signIn } from "../persistence";

type AccessState = "loading" | "anonymous" | "allowed" | "error";
const input = "w-full rounded-lg border border-ed-border bg-ed-surface px-3 py-2.5 text-sm text-ed-ink outline-none focus:border-ed-accent";

export function EditorAccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const session = await getSessionState();
      setState(session.session && session.membership?.active ? "allowed" : "anonymous");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível validar a sessão.");
      setState("error");
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (state === "loading") {
    return <div className="grid h-screen place-items-center bg-ed-bg text-sm text-ed-muted">Validando sessão…</div>;
  }
  if (state === "allowed") return <>{children}</>;
  if (state === "error") {
    return (
      <div className="grid h-screen place-items-center bg-ed-bg">
        <div className="w-[420px] rounded-xl border border-ed-border bg-ed-panel p-6 text-center">
          <b className="text-lg text-ed-ink">API indisponível</b>
          <p className="mt-2 text-sm text-ed-muted">{message}</p>
          <button className="mt-4 rounded bg-ed-surface px-4 py-2 text-xs text-ed-ink" onClick={() => { setState("loading"); void refresh(); }}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-screen place-items-center bg-ed-bg">
      <div className="w-[390px] rounded-xl border border-ed-border bg-ed-panel p-6 shadow-2xl">
        <div className="mb-5">
          <span className="text-[10px] font-bold tracking-[.18em] text-ed-accent">ASTERYON ENTERPRISE</span>
          <h1 className="mt-1 text-xl font-semibold text-ed-ink">Entrar no Editor</h1>
          <p className="mt-1 text-xs text-ed-muted">Sessão protegida pelo Worker ASTERYON e permissões da empresa.</p>
        </div>
        <div className="grid gap-2">
          <input className={input} type="email" placeholder="E-mail" value={email} onChange={(event) => setEmail(event.target.value)}/>
          <input className={input} type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)}/>
          <button
            className="rounded-lg bg-ed-accent px-4 py-2.5 text-sm font-semibold text-white"
            onClick={async () => {
              setMessage("");
              try {
                await signIn(email, password);
                await refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Falha ao autenticar");
              }
            }}
          >Entrar</button>
          {message && <p className="rounded bg-red-500/10 p-2 text-xs text-red-300">{message}</p>}
          <p className="pt-1 text-center text-[10px] text-ed-muted">A criação e ativação de novos usuários é controlada pelo administrador.</p>
        </div>
      </div>
    </div>
  );
}
