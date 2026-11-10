"use server";

import { redirect } from "next/navigation";
import { fromSupabaseError } from "../../data/result";
import { readPublicEnv } from "../../data/setup";
import { createClient } from "../../data/supabase/server";

async function adminDb() {
  if (!readPublicEnv().ok) redirect("/admin?blad=" + encodeURIComponent("Brak konfiguracji bazy."));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie?next=/admin");
  const { data: profile } = await supabase.from("profile").select("rola").eq("id", data.user.id).maybeSingle();
  if (profile?.rola !== "admin") redirect("/admin?blad=" + encodeURIComponent("Ta strona jest tylko dla administratora."));
  return supabase;
}

export async function approveVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await adminDb();
  const { error } = await supabase.rpc("zatwierdz_lokal", { p_lokal: id });
  const target = `/admin/${id}`;
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Lokal opublikowany. Goście widzą tę wersję.")}`);
}

export async function rejectVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("powod") ?? "").trim();
  const supabase = await adminDb();
  const { error } = await supabase.rpc("odrzuc_lokal", { p_lokal: id, p_powod: reason });
  const target = `/admin/${id}`;
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Zgłoszenie odrzucone. Poprzednia opublikowana wersja, jeśli była, zostaje na stronie.")}`);
}

export async function suspendVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const target = `/admin/lokale`;
  if (String(formData.get("potwierdz") ?? "") !== "tak") {
    redirect(`${target}?blad=${encodeURIComponent("Zaznacz potwierdzenie zawieszenia.")}`);
  }
  const supabase = await adminDb();
  const { error } = await supabase.rpc("zawies_lokal", { p_lokal: id });
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Lokal zawieszony. Strona publiczna zniknęła. Szkic nie został opublikowany.")}`);
}

export async function restoreSuspendedVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const target = `/admin/lokale`;
  if (String(formData.get("potwierdz") ?? "") !== "tak") {
    redirect(`${target}?blad=${encodeURIComponent("Zaznacz potwierdzenie przywrócenia.")}`);
  }
  const supabase = await adminDb();
  const { error } = await supabase.rpc("przywroc_zawieszony_lokal", { p_lokal: id });
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Przywrócono poprzednią publikację. Szkic właściciela nie wszedł na stronę.")}`);
}

export async function archiveVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await adminDb();
  const { error } = await supabase.rpc("archiwizuj_lokal", { p_lokal: id });
  const target = `/admin/${id}`;
  if (error) redirect(`${target}?blad=${encodeURIComponent(fromSupabaseError(error).detail)}`);
  redirect(`${target}?info=${encodeURIComponent("Lokal ukryty. Zniknął z wyszukiwania.")}`);
}
