"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, ShieldCheck, ArrowRight, LockKeyhole, CheckCircle2 } from "lucide-react";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = setupMode ? "/configuracao" : "/leads";
    });
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setMsg("E-mail ou senha incorretos. Confira seus dados e tente novamente.");
      setLoading(false);
      return;
    }
    window.location.href = "/leads";
  }

  return (
    <main className="login-page">
      <div className="login-glow" />
      <section className="login-shell">
        <div className="login-brand">
          <div className="login-logo"><Mail size={25} /></div>
          <div>
            <strong>PAINEL DE LEADS</strong>
            <span>Monitoramento automático</span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-top">
            <div className="login-badge"><LockKeyhole size={16} /> Acesso seguro</div>
            <h1>Bem-vindo</h1>
            <p>Entre com o e-mail que recebe seus leads para acessar seu painel.</p>
          </div>

          <form onSubmit={login} className="login-form">
            <label>
              E-MAIL
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </label>
            <label>
              SENHA
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>

            {msg && <div className="login-error">{msg}</div>}

            <button className="login-submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar no painel"} <ArrowRight size={17} />
            </button>
          </form>

          <button className="forgot-link" onClick={() => window.location.href="/senha"}>Esqueci minha senha</button>

          <button type="button" className="sync-box sync-button" onClick={() => { setSetupMode(true); document.querySelector<HTMLInputElement>('input[type="email"]')?.focus(); }}>
            <div className="sync-icon"><Mail size={19} /></div>
            <div className="sync-copy">
              <strong>Primeiro acesso?</strong>
              <span>Entre acima e, em seguida, autorize o Gmail no Google.</span>
            </div>
          </div>

          <div className="login-secure">
            <ShieldCheck size={16} />
            <span>Autenticação protegida pelo Supabase</span>
            <CheckCircle2 size={14} />
          </div>
        </div>

        <p className="login-footer">Cada conta é vinculada ao seu próprio e-mail do Google.</p>
      </section>
    </main>
  );
}