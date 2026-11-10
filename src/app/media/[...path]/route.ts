import { NextResponse } from "next/server";
import { mediaCacheHeaders } from "../../../domain/media-cache";
import { readPublicEnv } from "../../../data/setup";
import { createClient } from "../../../data/supabase/server";

const SAFE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!readPublicEnv().ok) {
    return new NextResponse("Brak konfiguracji", { status: 503, headers: mediaCacheHeaders(false) });
  }
  const { path } = await context.params;
  const key = path.join("/");
  if (!SAFE.test(key)) {
    return new NextResponse("Nie znaleziono", { status: 404, headers: mediaCacheHeaders(false) });
  }
  const supabase = await createClient();
  const published = await supabase
    .from("opublikowane_zdjecia")
    .select("id")
    .eq("sciezka", key)
    .maybeSingle();
  const headers = {
    ...mediaCacheHeaders(Boolean(published.data) && !published.error),
    "X-Content-Type-Options": "nosniff",
  };
  const { data, error } = await supabase.storage.from("zdjecia-lokali").download(key);
  if (error || !data) return new NextResponse("Nie znaleziono", { status: 404, headers });
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new NextResponse(await data.arrayBuffer(), {
    headers: { ...headers, "Content-Type": type },
  });
}
