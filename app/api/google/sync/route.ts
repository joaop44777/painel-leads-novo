import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Header = { name: string; value: string };
type Msg = {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: Header[];
    parts?: any[];
    body?: { data?: string };
  };
};

function b64(s: string) {
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

function headers(m: Msg) {
  return Object.fromEntries(
    (m.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value])
  );
}

function body(m: Msg): string {
  const p = m.payload;
  if (!p) return "";
  if (p.body?.data) return b64(p.body.data);

  for (const x of p.parts || []) {
    if (x.mimeType === "text/plain" && x.body?.data) return b64(x.body.data);
    const v = body(x);
    if (v) return v;
  }

  return "";
}

function field(text: string, names: string[]) {
  for (const n of names) {
    const r = new RegExp(
      "^\\s*" + n + "\\s*[:：-]\\s*(.+)$",
      "im"
    ).exec(text);
    if (r) return r[1].trim();
  }
  return null;
}

async function access(refresh: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  if (!r.ok) throw new Error("google_refresh_failed");
  return (await r.json()).access_token;
}

async function markAsRead(accessToken: string, messageId: string) {
  await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
      messageId +
      "/modify",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );
}

export async function POST(req: Request) {
  if (
    req.headers.get("authorization") !==
    "Bearer " + process.env.CRON_SECRET
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tokens } = await admin.rpc("get_google_tokens");

  let imported = 0;
  let notified = 0;

  for (const t of tokens || []) {
    try {
      const token = await access(t.refresh_token);

      const sr = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=20",
        { headers: { Authorization: "Bearer " + token } }
      );

      if (!sr.ok) continue;

      const list = await sr.json();

      for (const item of list.messages || []) {
        try {
          const mr = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
              item.id +
              "?format=full",
            { headers: { Authorization: "Bearer " + token } }
          );

          if (!mr.ok) continue;

          const m: Msg = await mr.json();
          const h = headers(m);
          const email = t.google_email;
          const text = body(m);
          const externalMessageId = h["message-id"] || m.id;

          const { data: profile } = await admin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .eq("active", true)
            .maybeSingle();

          if (!profile) continue;

          const lead = {
            name: field(text, ["NOME", "NOME DO CLIENTE"]),
            phone: field(text, ["TELEFONE", "CELULAR"]),
            plate: field(text, ["PLACA"]),
            taxi_app: field(text, ["TAXI/APP", "TAXI", "APP"]),
            received_at: new Date(
              Number(m.internalDate || Date.now())
            ).toISOString(),
            sender_email: h.from || null,
            subject: h.subject || null,
            raw_email: text,
            external_message_id: externalMessageId,
          };

          const { data: existing } = await admin
            .from("leads")
            .select("id")
            .eq("external_message_id", externalMessageId)
            .maybeSingle();

          let leadId = existing?.id;
          let isNew = false;

          if (!leadId) {
            const ins = await admin
              .from("leads")
              .insert(lead)
              .select("id")
              .single();

            if (ins.error || !ins.data) continue;

            leadId = ins.data.id;
            isNew = true;
            imported++;
          }

          const rec = await admin
            .from("lead_recipients")
            .upsert(
              {
                lead_id: leadId,
                user_id: profile.id,
                recipient_email: email,
              },
              { onConflict: "lead_id,user_id" }
            )
            .select("id")
            .single();

          if (!rec.data) continue;

          if (isNew) {
            const title = "Novo lead recebido";
            const message =
              "Um novo lead chegou no seu e-mail: " +
              (lead.name || "Sem nome");

            await admin.from("notifications").insert({
              user_id: profile.id,
              lead_id: leadId,
              title,
              message,
            });

            const { data: subs } = await admin
              .from("push_subscriptions")
              .select("endpoint,p256dh,auth")
              .eq("user_id", profile.id);

            for (const sub of subs || []) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  JSON.stringify({
                    title,
                    body: message,
                    url: "/leads",
                  })
                );
              } catch {
                await admin
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
              }
            }

            notified++;
          }

          await markAsRead(token, m.id);
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return Response.json({ ok: true, imported, notified });
}
