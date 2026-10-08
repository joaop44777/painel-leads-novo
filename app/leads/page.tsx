"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Bell, LogOut, RefreshCw, Search, SlidersHorizontal, Check, ChevronDown } from "lucide-react";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  plate: string | null;
  taxi_app: string | null;
  received_at: string | null;
  sender_email: string | null;
  status: string;
};

type Notice = {
  id: string;
  lead_id: string | null;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
  user_id: string;
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  contatado: "Contatado",
  convertido: "Convertido",
  perdido: "Perdido",
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function load() {
    const supabase = getSupabase();
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.href = "/";
      return;
    }

    setUser(auth.user);

    const [{ data: ls }, { data: ns }] = await Promise.all([
      supabase
        .from("leads")
        .select("id,name,phone,email,plate,taxi_app,received_at,sender_email,status")
        .order("received_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id,lead_id,title,message,read_at,created_at,user_id")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setLeads(ls || []);
    setNotices(ns || []);
    setLoading(false);
  }

  useEffect(() => {
    const supabase = getSupabase();
    load();

    const channel = supabase
      .channel("notifications-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        async (payload) => {
          const n = payload.new as Notice;
          const { data: auth } = await supabase.auth.getUser();
          if (n.user_id !== auth.user?.id) return;

          setNotices((items) => [n, ...items].slice(0, 30));
          setNotificationsOpen(true);

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(n.title, { body: n.message });
          }

          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function enablePush() {
    const supabase = getSupabase();
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.register("/sw.js");
    const keyRes = await fetch("/api/push/vapid-public");
    const { publicKey } = await keyRes.json();
    if (!publicKey) return;

    const b64 = (value: string) =>
      Uint8Array.from(
        atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=="),
        (c) => c.charCodeAt(0)
      );

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64(publicKey),
      });
    }

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
        },
        body: JSON.stringify(sub.toJSON()),
      });
    }
  }

  async function markRead(id: string) {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    setNotices((items) =>
      items.map((n) => (n.id === id ? { ...n, read_at: now } : n))
    );
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus = status === "todos" || lead.status === status;
      const haystack = [
        lead.name,
        lead.phone,
        lead.email,
        lead.plate,
        lead.taxi_app,
        lead.sender_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [leads, q, status]);

  const unread = notices.filter((n) => !n.read_at).length;

  return (
    <main className="leads-app">
      <header className="leads-header">
        <div className="leads-brand">
          <div className="brand-square">L</div>
          <div>
            <strong>Painel de Leads</strong>
            <span>Leads recebidos por e-mail</span>
          </div>
        </div>

        <div className="leads-header-right">
          <button
            className="header-icon"
            title="Notificações"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              enablePush();
            }}
          >
            <Bell size={19} />
            {unread > 0 && <b>{unread}</b>}
          </button>

          <div className="account">
            <div className="account-avatar">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div>
              <strong>{user?.email || "Usuário"}</strong>
              <span>Conta conectada</span>
            </div>
            <ChevronDown size={15} />
          </div>

          <button
            className="logout-button"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.href = "/";
            }}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {notificationsOpen && (
        <aside className="notification-panel">
          <div className="notification-title">
            <div>
              <strong>Notificações</strong>
              <span>{unread} não lidas</span>
            </div>
            <button onClick={() => setNotificationsOpen(false)}>×</button>
          </div>

          {notices.length === 0 ? (
            <div className="notification-empty">Nenhuma notificação.</div>
          ) : (
            notices.map((notice) => (
              <button
                className={"notification-item " + (!notice.read_at ? "unread" : "")}
                key={notice.id}
                onClick={() => markRead(notice.id)}
              >
                <div className="notification-dot" />
                <div>
                  <strong>{notice.title}</strong>
                  <p>{notice.message}</p>
                  <small>{new Date(notice.created_at).toLocaleString("pt-BR")}</small>
                </div>
                {!notice.read_at && <Check size={15} />}
              </button>
            ))
          )}
        </aside>
      )}

      <section className="leads-content">
        <div className="leads-title-row">
          <div>
            <h1>Leads</h1>
            <p>Visualize e acompanhe os leads que chegaram para esta conta.</p>
          </div>

          <button className="refresh-button" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </div>

        <div className="lead-tools">
          <div className="lead-search">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone, e-mail, placa..."
            />
          </div>

          <button
            className={"filter-button " + (filtersOpen ? "active" : "")}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} />
            Filtros
            {status !== "todos" && <span>1</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="filters-bar">
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="novo">Novo</option>
                <option value="em_atendimento">Em atendimento</option>
                <option value="contatado">Contatado</option>
                <option value="convertido">Convertido</option>
                <option value="perdido">Perdido</option>
              </select>
            </label>

            <button
              className="clear-filter"
              onClick={() => {
                setStatus("todos");
                setQ("");
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}

        <div className="lead-summary">
          <strong>{filtered.length}</strong>
          <span>{filtered.length === 1 ? "lead encontrado" : "leads encontrados"}</span>
        </div>

        <div className="lead-table-card">
          {loading ? (
            <div className="table-empty">Carregando leads...</div>
          ) : filtered.length === 0 ? (
            <div className="table-empty">
              <strong>Nenhum lead encontrado</strong>
              <span>Quando um lead chegar, ele aparecerá aqui.</span>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>LEAD</th>
                    <th>TELEFONE</th>
                    <th>E-MAIL</th>
                    <th>PLACA</th>
                    <th>TAXI / APP</th>
                    <th>RECEBIDO</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr id={"lead-" + lead.id} key={lead.id}>
                      <td>
                        <div className="lead-name-cell">
                          <div className="lead-avatar">
                            {(lead.name?.[0] || "?").toUpperCase()}
                          </div>
                          <strong>{lead.name || "Sem nome"}</strong>
                        </div>
                      </td>
                      <td>{lead.phone || "—"}</td>
                      <td>{lead.email || "—"}</td>
                      <td>{lead.plate || "—"}</td>
                      <td>{lead.taxi_app || "—"}</td>
                      <td>
                        {lead.received_at
                          ? new Date(lead.received_at).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td>
                        <span className={"lead-status " + lead.status}>
                          {statusLabels[lead.status] || lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}