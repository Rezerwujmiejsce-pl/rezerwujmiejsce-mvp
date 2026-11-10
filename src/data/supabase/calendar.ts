import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { createClient } from "./server";

export type PublicDay = { dzien: string; stan: "wolne" | "zajete" | "wstrzymane" };

export type OwnerBlock = {
  id: string;
  salaId: string | null;
  dzien: string;
  od: string | null;
  doo: string | null;
  notatka: string | null;
};

export async function publicAvailability(venueId: string, from: string, to: string): Promise<DataResult<PublicDay[]>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pasek_dostepnosci", {
      p_lokal: venueId,
      p_od: from,
      p_do: to,
    });
    if (error) {
      if (/42P01|PGRST205|does not exist|schema cache|pasek_dostepnosci/i.test(`${error.code ?? ""} ${error.message ?? ""}`)) {
        return { ok: true, data: [] };
      }
      return fromSupabaseError(error);
    }
    return {
      ok: true,
      data: (data ?? []).map((row: { dzien: string; stan: string }) => ({
        dzien: String(row.dzien),
        stan: row.stan === "wstrzymane" || row.stan === "zajete" ? row.stan : "wolne",
      })),
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function listBlocks(venueId: string): Promise<DataResult<OwnerBlock[]>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blokady_terminu")
      .select("id, sala_id, dzien, godzina_od, godzina_do, notatka")
      .eq("lokal_id", venueId)
      .order("dzien");
    if (error) {
      if (/42P01|PGRST205|does not exist|schema cache/i.test(`${error.code ?? ""} ${error.message ?? ""}`)) {
        return { ok: true, data: [] };
      }
      return fromSupabaseError(error);
    }
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: String(row.id),
        salaId: row.sala_id ? String(row.sala_id) : null,
        dzien: String(row.dzien),
        od: row.godzina_od ? String(row.godzina_od).slice(0, 5) : null,
        doo: row.godzina_do ? String(row.godzina_do).slice(0, 5) : null,
        notatka: row.notatka ? String(row.notatka) : null,
      })),
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}
