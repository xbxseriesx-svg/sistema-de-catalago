import os
import sys
import threading
import webbrowser
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote
import tkinter as tk
from tkinter import messagebox

APP_NAME = "ASTERYON Catálogo Digital"


def resource_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "web"
    return Path(__file__).resolve().parent.parent / "dist"


WEB_ROOT = resource_root().resolve()


class SPAHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        relative = unquote(parsed.path.lstrip("/"))
        target = (WEB_ROOT / relative).resolve() if relative else WEB_ROOT / "index.html"

        try:
            target.relative_to(WEB_ROOT)
        except ValueError:
            self.send_error(403)
            return

        if relative and target.exists() and target.is_file():
            return super().do_GET()

        # Rotas SPA como /admin devem retornar index.html.
        if not relative or "." not in Path(relative).name:
            original = self.path
            self.path = "/index.html"
            try:
                return super().do_GET()
            finally:
                self.path = original

        self.send_error(404)


def start_server():
    handler = partial(SPAHandler, directory=str(WEB_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, server.server_address[1]


def main():
    if not (WEB_ROOT / "index.html").exists():
        messagebox.showerror(APP_NAME, f"Arquivos do portal não encontrados em: {WEB_ROOT}")
        return

    server, port = start_server()
    base_url = f"http://127.0.0.1:{port}"

    root = tk.Tk()
    root.title("ASTERYON Catálogo — Teste Local Windows 11")
    root.geometry("520x360")
    root.resizable(False, False)

    frame = tk.Frame(root, padx=26, pady=22)
    frame.pack(fill="both", expand=True)

    title = tk.Label(frame, text="ASTERYON CATÁLOGO DIGITAL", font=("Segoe UI", 16, "bold"))
    title.pack(anchor="w")

    subtitle = tk.Label(frame, text="Modo de teste local / QA", font=("Segoe UI", 10))
    subtitle.pack(anchor="w", pady=(2, 18))

    status = tk.Label(frame, text="● Servidor local ativo", fg="#0B5D3B", font=("Segoe UI", 10, "bold"))
    status.pack(anchor="w")

    info = tk.Label(
        frame,
        text=(
            "Todas as funções locais do Editor Visual estão liberadas para teste.\n"
            "Dados e rascunhos ficam somente neste computador (localStorage).\n\n"
            "Login ADMIN local:\n"
            "admin@empresa.com.br\n"
            "Senha: admin123"
        ),
        justify="left",
        font=("Segoe UI", 10),
    )
    info.pack(anchor="w", pady=(12, 18))

    buttons = tk.Frame(frame)
    buttons.pack(fill="x", pady=(0, 14))

    def open_portal():
        webbrowser.open(f"{base_url}/")

    def open_admin():
        webbrowser.open(f"{base_url}/admin")

    portal_btn = tk.Button(buttons, text="Abrir Portal Público", command=open_portal, width=21, height=2)
    portal_btn.pack(side="left", padx=(0, 10))

    admin_btn = tk.Button(buttons, text="Abrir Painel ADMIN", command=open_admin, width=21, height=2)
    admin_btn.pack(side="left")

    warning = tk.Label(
        frame,
        text=(
            "Observação: Supabase real, pesquisa online real e geração final de imagens por IA\n"
            "dependem de serviços/credenciais externos. No EXE, o ASTERYON AI usa o motor local seguro."
        ),
        justify="left",
        fg="#5B6878",
        font=("Segoe UI", 8),
    )
    warning.pack(anchor="w", pady=(4, 8))

    def close_app():
        try:
            server.shutdown()
            server.server_close()
        finally:
            root.destroy()

    exit_btn = tk.Button(frame, text="Encerrar ASTERYON Local", command=close_app, width=24)
    exit_btn.pack(anchor="e", pady=(8, 0))

    root.protocol("WM_DELETE_WINDOW", close_app)
    root.after(700, open_portal)
    root.mainloop()


if __name__ == "__main__":
    main()
