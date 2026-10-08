"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, ShieldCheck, ArrowRight, LockKeyhole, CheckCircle2 } from "lucide-react";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/leads";
    });
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("E-mail ou senha incorretos. Confira seus dados e tente novamente.");
      setLoading(false);
      return;
    }

    window.location.href = "/leads";
  }

  function handleForgotPassword() {
    window.location.href = "/senha";
  }

  function handleFirstAccess() {
    const input = document.querySelector('input[type="email"]');
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }

  return (
    <main className="login-page">
      <div className="login-glow" />
      <section className="login-shell">
        <header className="login-brand">
          <div className="login-logo">
            <Mail size={25} />
          </div>
          <div>
            <strong>PAINEL DE LEADS</strong>
            <span>Monitoramento automático</span>
          </div>
        </header>

        <section className="login-card">
          <div className="login-card-top">
            <div className="login-badge">
              <LockKeyhole size={16} />
              <span>Acesso seguro</span>
            </div>
            <h1>Bem-vindo</h1>
            <p>Entre com o e-mail que recebe seus leads para acessar seu painel.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              E-MAIL
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                required
              />
            </label>

            <label>
              SENHA
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Senha"
                required
              />
            </label>

            {message ? <div className="login-error">{message}</div> : null}

            <button type="submit" className="login-submit" disabled={loading}>
              <span>{loading ? "Entrando..." : "Entrar no painel"}</span>
              <ArrowRight size={17} />
            </button>
          </form>

          <button type="button" className="forgot-link" onClick={handleForgotPassword}>
            Esqueci minha senha
          </button>

          <button type="button" className="sync-box sync-button" onClick={handleFirstAccess}>
            <span className="sync-icon">
              <Mail size={19} />
            </span>
            <span className="sync-copy">
              <strong>Primeiro acesso?</strong>
              <span>Entre acima e, em seguida, autorize o Gmail no Google.</span>
            </span>
          </button>

          <div className="login-secure">
            <ShieldCheck size={16} />
            <span>Autenticação protegida pelo Supabase</span>
            <CheckCircle2 size={14} />
          </div>
        </section>

        <p className="login-footer">
          Cada conta é vinculada ao seu próprio e-mail do Google.
        </p>
      </section>
    </main>
  );
}
