export type Setup =
  | { ok: true; url: string; key: string }
  | { ok: false; missing: string[] };

export function readPublicEnv(): Setup {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length) return { ok: false, missing };
  return { ok: true, url, key };
}

export function setupMessage(missing: string[]): string {
  return `Aplikacja nie jest połączona z bazą. W pliku .env.local brakuje: ${missing.join(", ")}. Bez tego nie pokazujemy lokali — też nie wymyślamy przykładowych.`;
}
