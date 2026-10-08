"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Bell,
  Check,
  ChevronDown,
  Filter,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";

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
  novo: "Parado",
  em_atendimento: "Atendido",
  contatado: "Atendido",
  convertido: "Atendido",
  perdido: "Perdido",
};

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(value: string | null) {
  if (!value) return "Não informado";
  return value;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeSection, setActiveSection] = useState<"parados" | "atendidos">("parados");

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
        .select(
          "id,name,phone,email,plate,taxi_app,received_at,sender_email,status"
        )
        .order("received_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id,lead_id,title,message,read_at,created_at,user_id")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setLeads(ls || []);
    setNotices(ns || []);
    setLastUpdated(new Date());
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
            new Notification(n.title, {
              body: n.message,
              icon: "/icon-192.png",
            });
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

  function openLeadFromNotification(notice: Notice) {
    if (notice.lead_id) {
      setNotificationsOpen(false);
      requestAnimationFrame(() => {
        document
          .getElementById("lead-" + notice.lead_id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    markRead(notice.id);
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesStatus =
        status === "todos" ||
        (status === "parados" && lead.status === "novo") ||
        (status === "atendidos" &&
          ["em_atendimento", "contatado", "convertido"].includes(lead.status)) ||
        (status === "perdidos" && lead.status === "perdido");

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

      const sectionMatch = activeSection === "parados" ? lead.status === "novo" : ["em_atendimento", "contatado", "convertido"].includes(lead.status);
      return sectionMatch && matchesStatus && (!term || haystack.includes(term));
    });
  }, [leads, q, status]);

  const stopped = leads.filter((lead) => lead.status === "novo").length;
  const attended = leads.filter((lead) =>
    ["em_atendimento", "contatado", "convertido"].includes(lead.status)
  ).length;
  const unread = notices.filter((n) => !n.read_at).length;

  return (
    <main className={"leads-app " + (darkMode ? "dark" : "")}>
      <header className="leads-header">
        <div className="leads-brand">
          <div className="brand-mark">
            <span>L</span>
          </div>
          <div>
            <strong>PAINEL DE LEADS</strong>
            <span>Monitoramento automático</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="connection-pill">
            <span className="connection-dot" />
            Conectado
          </div>

          <button
            className="notification-trigger"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              enablePush();
            }}
          >
            <Bell size={17} />
            {unread > 0 && <b>{unread}</b>}
          </button>

          <div className="account">
            <div className="account-avatar">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="account-copy">
              <strong>{user?.email || "Usuário"}</strong>
              <span>Conta conectada</span>
            </div>
            <ChevronDown size={14} />
          </div>

          <button
            className="icon-action"
            title="Configurações"
            onClick={() => (window.location.href = "/configuracao")}
          >
            <Settings size={17} />
          </button>

          <button
            className="logout-button"
            onClick={async () => {
              await getSupabase().auth.signOut();
              window.location.href = "/";
            }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </header>

      <div className="notification-status">
        <span className="notification-live-dot" />
        <strong>Notificações {notificationsEnabled ? "ativadas" : "desativadas"}</strong>
        <button className="notification-enable" onClick={enablePush}>Ativar notificações</button>
        <button className="theme-toggle" onClick={() => setDarkMode(v => !v)}>{darkMode ? "☀ Claro" : "☾ Escuro"}</button>
      </div>

      {notificationsOpen && (
        <aside className="notification-panel">
          <div className="notification-title">
            <div>
              <strong>Notificações</strong>
              <span>{unread} não lidas</span>
            </div>
            <button onClick={() => setNotificationsOpen(false)}>
              <X size={17} />
            </button>
          </div>

          {notices.length === 0 ? (
            <div className="notification-empty">
              <Bell size={22} />
              <strong>Nenhuma notificação</strong>
              <span>Novos leads aparecerão aqui.</span>
            </div>
          ) : (
            notices.map((notice) => (
              <button
                className={
                  "notification-item " + (!notice.read_at ? "unread" : "")
                }
                key={notice.id}
                onClick={() => openLeadFromNotification(notice)}
              >
                <div className="notification-dot" />
                <div>
                  <strong>{notice.title}</strong>
                  <p>{notice.message}</p>
                  <small>{formatDate(notice.created_at)}</small>
                </div>
                {!notice.read_at && <Check size={15} />}
              </button>
            ))
          )}
        </aside>
      )}

      <section className="leads-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">VISÃO GERAL</div>
            <h1>Leads</h1>
            <p>Visualize e acompanhe os leads recebidos nesta conta.</p>
          </div>

          <button className="refresh-button" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Atualizar
          </button>
        </div>

        <div className="summary-grid">
          <div className="summary-card stopped">
            <div>
              <span>Leads parados</span>
              <strong>{stopped}</strong>
            </div>
            <div className="summary-icon">!</div>
          </div>

          <div className="summary-card attended">
            <div>
              <span>Leads atendidos</span>
              <strong>{attended}</strong>
            </div>
            <div className="summary-icon">✓</div>
          </div>

          <div className="summary-card update">
            <div>
              <span>Última atualização</span>
              <strong>{lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR") : "--:--:--"}</strong>
            </div>
            <div className="summary-icon">
              <RefreshCw size={17} />
            </div>
          </div>
        </div>

        <div className="section-heading">
          <div><h2>Leads</h2><span>{filtered.length} registros exibidos</span></div>
          <div className="lead-tabs">
            <button className={activeSection === "parados" ? "active" : ""} onClick={() => setActiveSection("parados")}>Leads Parados <b>{stopped}</b></button>
            <button className={activeSection === "atendidos" ? "active" : ""} onClick={() => setActiveSection("atendidos")}>Leads Atendidos <b>{attended}</b></button>
          </div>
        </div>

        <div className="lead-tools">
          <div className="lead-search">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, telefone, placa ou e-mail..."
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Limpar busca">
                <X size={15} />
              </button>
            )}
          </div>

          <button
            className={"filter-button " + (filtersOpen ? "active" : "")}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter size={16} />
            Filtros
            {status !== "todos" && <span>1</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="filters-bar">
            <div className="filter-label">STATUS</div>
            <button
              className={status === "todos" ? "selected" : ""}
              onClick={() => setStatus("todos")}
            >
              Todos
            </button>
            <button
              className={status === "parados" ? "selected" : ""}
              onClick={() => setStatus("parados")}
            >
              Parados
            </button>
            <button
              className={status === "atendidos" ? "selected" : ""}
              onClick={() => setStatus("atendidos")}
            >
              Atendidos
            </button>
            <button
              className={status === "perdidos" ? "selected" : ""}
              onClick={() => setStatus("perdidos")}
            >
              Perdidos
            </button>
            <button
              className="clear-filter"
              onClick={() => {
                setStatus("todos");
                setQ("");
              }}
            >
              Limpar
            </button>
          </div>
        )}

        <div className="leads-list">
          {loading ? (
            <div className="list-empty">
              <RefreshCw size={20} className="spin" />
              <strong>Carregando leads...</strong>
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-empty">
              <div className="empty-mark">L</div>
              <strong>Nenhum lead encontrado</strong>
              <span>
                Quando um novo lead chegar, ele aparecerá automaticamente aqui.
              </span>
            </div>
          ) : (
            filtered.map((lead) => {
              const statusClass =
                lead.status === "novo"
                  ? "stopped"
                  : lead.status === "perdido"
                    ? "lost"
                    : "attended";

              return (
                <article className="lead-card" id={"lead-" + lead.id} key={lead.id}>
                  <div className="lead-main">
                    <div className="lead-avatar">
                      {(lead.name?.[0] || "?").toUpperCase()}
                    </div>

                    <div className="lead-identity">
                      <strong>{lead.name || "Nome não informado"}</strong>
                      <span>WhatsApp</span>
                    </div>
                  </div>

                  <div className="lead-data">
                    <div>
                      <small>TELEFONE</small>
                      <strong>{formatPhone(lead.phone)}</strong>
                    </div>
                    <div>
                      <small>PLACA</small>
                      <strong>{lead.plate || "Não informada"}</strong>
                    </div>
                    <div>
                      <small>TÁXI / APP</small>
                      <strong>{lead.taxi_app || "Não informado"}</strong>
                    </div>
                    <div className="received">
                      <small>RECEBIDO EM</small>
                      <strong>{formatDate(lead.received_at)}</strong>
                    </div>
                  </div>

                  <div className="lead-actions">
                    {lead.status === "novo" ? <button className="attend-button" onClick={async () => { const sb=getSupabase(); await sb.from("leads").update({status:"em_atendimento"}).eq("id",lead.id); await load(); }}>Atendido</button> : <div className={"lead-status " + statusClass}><span />{statusLabels[lead.status] || lead.status}</div>}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
