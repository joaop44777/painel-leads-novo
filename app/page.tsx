"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Mail, ShieldCheck, ArrowRight, UserRound } from "lucide-react";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export default function Home(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [loading,setLoading]=useState(false); const [msg,setMsg]=useState("");
 useEffect(()=>{if(supabase) supabase.auth.getSession().then(({data})=>{if(data.session) window.location.href="/leads"})},[]);
 async function login(e:React.FormEvent){e.preventDefault();setLoading(true);setMsg("");
  if(!supabase){setMsg("Configure as variáveis do Supabase no Vercel.");setLoading(false);return}
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error)setMsg(error.message);else window.location.href="/leads";setLoading(false);
 }
 return <main className="auth"><section className="auth-card">
   <div className="brand"><div className="brand-icon"><Mail size={24}/></div><div><strong>Painel de Leads</strong><span>Receba e organize seus leads</span></div></div>
   <h1>Entrar</h1><p className="muted">Use o e-mail que recebe os leads.</p>
   <form onSubmit={login}>
    <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/></label>
    <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label>
    {msg&&<div className="error">{msg}</div>}
    <button disabled={loading}>{loading?"Entrando...":"Entrar"} <ArrowRight size={18}/></button>
   </form>
   <div className="secure"><ShieldCheck size={17}/><span>Acesso protegido pelo Supabase Auth</span></div>
 </section></main>
}