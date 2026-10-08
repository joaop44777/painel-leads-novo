"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react";

function getSupabase(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);}

export default function SenhaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase=getSupabase();
    let active = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const hasRecoveryMode = new URLSearchParams(window.location.search).get("mode") === "reset";
      if (data.session?.user) {
        setUserEmail(data.session.user.email || "");
        setRecovery(hasRecoveryMode);
      }
      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setUserEmail(session?.user?.email || "");
        setMsg("");
        setError("");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setMsg(""); setError("");
    const supabase=getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/senha?mode=reset",
    });
    if (error) setError(error.message);
    else setMsg("Enviamos um link para seu e-mail. Abra o link para criar uma nova senha.");
    setSending(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setMsg(""); setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      setSending(false);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      setSending(false);
      return;
    }
    const supabase=getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setMsg("Senha alterada com sucesso.");
      setPassword(""); setConfirm("");
      setRecovery(false);
      setTimeout(() => { window.location.href = "/leads"; }, 900);
    }
    setSending(false);
  }

  if (loading) return <main className="auth"><section className="auth-card"><p className="muted">Carregando...</p></section></main>;

  const loggedIn = !!userEmail && !recovery;

  return (
    <main className="auth">
      <section className="auth-card">
        <div className="brand">
          <div className="brand-icon"><KeyRound size={24}/></div>
          <div><strong>Painel de Leads</strong><span>Segurança da sua conta</span></div>
        </div>

        {loggedIn ? (
          <>
            <h1>Alterar senha</h1>
            <p className="muted">Defina uma nova senha para <strong>{userEmail}</strong>.</p>
            <form onSubmit={changePassword}>
              <label>Nova senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} required/></label>
              <label>Confirmar nova senha<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita a nova senha" minLength={6} required/></label>
              {error && <div className="error">{error}</div>}
              {msg && <div className="success"><CheckCircle2 size={16}/> {msg}</div>}
              <button disabled={sending}>{sending ? "Salvando..." : "Alterar senha"} <KeyRound size={17}/></button>
            </form>
            <button className="ghost back-button" onClick={()=>window.location.href="/leads"}><ArrowLeft size={17}/> Voltar para os leads</button>
          </>
        ) : (
          <>
            <h1>Esqueci minha senha</h1>
            <p className="muted">Digite seu e-mail de acesso e enviaremos um link para criar uma nova senha.</p>
            <form onSubmit={requestReset}>
              <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/></label>
              {error && <div className="error">{error}</div>}
              {msg && <div className="success"><CheckCircle2 size={16}/> {msg}</div>}
              <button disabled={sending}>{sending ? "Enviando..." : "Enviar link"} <Mail size={17}/></button>
            </form>
            <button className="ghost back-button" onClick={()=>window.location.href="/"}><ArrowLeft size={17}/> Voltar para o login</button>
          </>
        )}
      </section>
    </main>
  );
}
