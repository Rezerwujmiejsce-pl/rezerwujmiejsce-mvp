import { NextResponse } from "next/server";
import { readPublicEnv } from "../../../data/setup";
import { createClient } from "../../../data/supabase/server";

const SAFE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/;

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!readPublicEnv().ok) return new NextResponse("Brak konfiguracji", { status: 503 });
  const { path } = await context.params;
  const key = path.join("/");
  if (!SAFE.test(key)) return new NextResponse("Nie znaleziono", { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("zdjecia-lokali").download(key);
  if (error || !data) return new NextResponse("Nie znaleziono", { status: 404 });
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
