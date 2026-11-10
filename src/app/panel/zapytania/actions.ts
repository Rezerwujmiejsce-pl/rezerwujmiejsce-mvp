"use server";

import { redirect } from "next/navigation";
import { fromSupabaseError } from "../../../data/result";
import { readPublicEnv } from "../../../data/setup";
import { createClient } from "../../../data/supabase/server";

function fail(path: string, detail: string): never {
  redirect(`${path}?blad=${encodeURIComponent(detail)}`);
}

export async function rejectInquiry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = /^[0-9a-f-]{36}$/i.test(id) ? `/panel/zapytania/${id}` : "/panel/zapytania";
  if (!readPublicEnv().ok) fail(back, "Brak konfiguracji bazy.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail("/panel/zapytania", "Nie ma takiego zapytania.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("odrzuc_zapytanie", { p_id: id });
  if (error) fail(back, fromSupabaseError(error).detail);
  redirect(`${back}?info=${encodeURIComponent("Zapytanie zostało odrzucone. Rezerwacji nie ma.")}`);
}
