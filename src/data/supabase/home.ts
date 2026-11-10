import { HOME_BANNERS, type HomeBanner, type HomePublication, type HomeTileSetting } from "../../domain/home";
import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { createClient } from "./server";

export type HomeLoad = {
  publication: HomePublication | null;
  missing: boolean;
};

function missingTable(error: { code?: string; message?: string } | null): boolean {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(message);
}

export async function loadPublishedHome(): Promise<DataResult<HomeLoad>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const [copy, tiles] = await Promise.all([
      supabase.from("strona_publikacja").select("naglowek, podtytul, baner").eq("id", 1).maybeSingle(),
      supabase.from("strona_publikacja_okazje").select("kod, kolejnosc, widoczna"),
    ]);
    if (missingTable(copy.error) || missingTable(tiles.error)) {
      return { ok: true, data: { publication: null, missing: true } };
    }
    if (copy.error) return fromSupabaseError(copy.error);
    if (tiles.error) return fromSupabaseError(tiles.error);
    if (!copy.data) return { ok: true, data: { publication: null, missing: false } };
    return {
      ok: true,
      data: {
        missing: false,
        publication: {
          naglowek: String(copy.data.naglowek),
          podtytul: String(copy.data.podtytul),
          baner: String(copy.data.baner),
          kafle: (tiles.data ?? []).map(tile),
        },
      },
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function loadHomeDraft(): Promise<DataResult<HomeLoad>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const [copy, tiles] = await Promise.all([
      supabase.from("strona_szkic").select("naglowek, podtytul, baner").eq("id", 1).maybeSingle(),
      supabase.from("strona_szkic_okazje").select("kod, kolejnosc, widoczna"),
    ]);
    if (missingTable(copy.error) || missingTable(tiles.error)) {
      return { ok: true, data: { publication: null, missing: true } };
    }
    if (copy.error) return fromSupabaseError(copy.error);
    if (tiles.error) return fromSupabaseError(tiles.error);
    if (!copy.data) return { ok: true, data: { publication: null, missing: false } };
    return {
      ok: true,
      data: {
        missing: false,
        publication: {
          naglowek: String(copy.data.naglowek),
          podtytul: String(copy.data.podtytul),
          baner: String(copy.data.baner),
          kafle: (tiles.data ?? []).map(tile),
        },
      },
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

function tile(row: { kod: string; kolejnosc: number; widoczna: boolean }): HomeTileSetting {
  return {
    kod: String(row.kod),
    kolejnosc: Number(row.kolejnosc),
    widoczna: Boolean(row.widoczna),
  };
}

export function bannerOrDefault(value: string): HomeBanner {
  return HOME_BANNERS.includes(value as HomeBanner) ? (value as HomeBanner) : "/img/hero.webp";
}
