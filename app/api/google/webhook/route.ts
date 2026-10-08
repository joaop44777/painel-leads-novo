import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint chamado pelo Google Cloud Pub/Sub quando o Gmail detecta
 * uma mudança na caixa de entrada. O Pub/Sub não precisa conhecer
 * credenciais do Supabase; ele só acorda o backend, que executa a
 * sincronização existente.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.GOOGLE_PUBSUB_SECRET || secret !== process.env.GOOGLE_PUBSUB_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const origin = url.origin;
    const syncUrl = new URL("/api/google/sync", origin);

    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.AUTOMATIC_SYNC_SECRET,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, syncStatus: response.status },
        { status: 502 }
      );
    }

    const result = await response.json();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
