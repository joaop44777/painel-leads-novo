"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LogOut, Search, UserRound, RefreshCw } from "lucide-react";
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
type Lead={id:string;name:string|null;phone:string|null;plate:string|null;taxi_app:string|null;received_at:string|null;status:string};
export default function Leads(){
 const [leads,setLeads]=useState<Lead[]>([]); const [loading,setLoading]=useState(true); const [user,setUser]=useState<any>(null); const [q,setQ]=useState("");
 async function load(){setLoading(true);const {data:{user}}=await supabase.auth.getUser();if(!user){location.href="/";return}setUser(user);
  const {data,error}=await supabase.from("leads").select("id,name,phone,plate,taxi_app,received_at,status").order("received_at",{ascending:false}); if(!error)setLeads(data||[]);setLoading(false)}
 useEffect(()=>{load()},[]);
 const filtered=leads.filter(x=>[x.name,x.phone,x.plate,x.taxi_app].join(" ").toLowerCase().includes(q.toLowerCase()));
 return <main className="app"><header><div className="brand"><div className="brand-icon"><UserRound size={21}/></div><div><strong>Painel de Leads</strong><span>Leads recebidos por e-mail</span></div></div><div className="header-actions"><span>{user?.email}</span><button className="ghost" onClick={async()=>{await supabase.auth.signOut();location.href="/"}}><LogOut size={17}/> Sair</button></div></header>
 <section className="content"><div className="page-head"><div><h1>Meus Leads</h1><p>Acompanhe os leads que chegaram para você.</p></div><button className="ghost" onClick={load}><RefreshCw size={17}/> Atualizar</button></div>
 <div className="toolbar"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome, telefone, placa..."/></div>
 <div className="table-wrap">{loading?<div className="empty">Carregando leads...</div>:filtered.length===0?<div className="empty">Nenhum lead encontrado.</div>:<table><thead><tr><th>Lead</th><th>Telefone</th><th>Placa</th><th>Taxi/App</th><th>Recebido</th><th>Status</th></tr></thead><tbody>{filtered.map(l=><tr key={l.id}><td><strong>{l.name||"Sem nome"}</strong></td><td>{l.phone||"—"}</td><td>{l.plate||"—"}</td><td>{l.taxi_app||"—"}</td><td>{l.received_at?new Date(l.received_at).toLocaleString("pt-BR"):"—"}</td><td><span className={"status "+l.status}>{l.status.replace("_"," ")}</span></td></tr>)}</tbody></table>}</div>
 </section></main>
}