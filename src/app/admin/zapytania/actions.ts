"use server";

import { redirect } from "next/navigation";
import { fromSupabaseError } from "../../../data/result";
import { readPublicEnv } from "../../../data/setup";
import { createClient } from "../../../data/supabase/server";

const STATUSES = new Set(["nowe", "zaakceptowane", "odrzucone", "anulowane", "wygasle", "inny_termin"]);

export async function setInquiryStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const target = `/admin/zapytania/${id}`;
  if (!readPublicEnv().ok) redirect("/admin/zapytania?blad=" + encodeURIComponent("Brak konfiguracji bazy."));
  if (String(formData.get("potwierdz") ?? "") !== "tak") {
    redirect(`${target}?blad=${encodeURIComponent("Zaznacz potwierdzenie zmiany statusu.")}`);
  }
  if (!STATUSES.has(status)) {
    redirect(`${target}?blad=${encodeURIComponent("Wybierz status z listy.")}`);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie?next=/admin/zapytania");
  const { data: profile } = await supabase.from("profile").select("rola").eq("id", data.user.id).maybeSingle();
  if (profile?.rola !== "admin") redirect("/panel");
  const { error } = await supabase.rpc("ustaw_status_zapytania", { p_id: id, p_status: status });
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Status zapisany. Płatność nie powstała i wiadomość nie wyszła.")}`);
}
