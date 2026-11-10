"use server";

import { redirect } from "next/navigation";
import { saturdaysInMonth } from "../../../../domain/calendar";
import { fromSupabaseError } from "../../../../data/result";
import { readPublicEnv } from "../../../../data/setup";
import { createClient } from "../../../../data/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(id: string, detail: string): never {
  redirect(`/panel/${id}/kalendarz?blad=${encodeURIComponent(detail)}`);
}

export async function addAvailabilityBlock(formData: FormData) {
  const id = String(formData.get("lokal") ?? "");
  if (!UUID.test(id)) back(id || "x", "Nie ma takiego lokalu.");
  if (!readPublicEnv().ok) back(id, "Brak konfiguracji bazy.");
  const day = String(formData.get("dzien") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) back(id, "Podaj dzień.");
  const roomRaw = String(formData.get("sala") ?? "");
  const room = roomRaw && UUID.test(roomRaw) ? roomRaw : null;
  const from = String(formData.get("od") ?? "");
  const to = String(formData.get("do") ?? "");
  const whole = formData.get("caly") === "on" || (!from && !to);
  const days = formData.get("soboty") === "on" ? saturdaysInMonth(day) : [day];
  if (days.length === 0) back(id, "W tym miesiącu nie ma przyszłej soboty.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("dodaj_blokady_dni", {
    p_lokal: id,
    p_sala: room,
    p_dni: days,
    p_od: whole ? null : from,
    p_do: whole ? null : to,
    p_notatka: String(formData.get("notatka") ?? ""),
  });
  if (error) back(id, fromSupabaseError(error).detail);
  redirect(`/panel/${id}/kalendarz?dzien=${day}&info=${encodeURIComponent("Blokada zapisana. Zapytania nie zostały odwołane.")}`);
}

export async function clearAvailabilityInterval(formData: FormData) {
  const id = String(formData.get("lokal") ?? "");
  if (!UUID.test(id)) back(id || "x", "Nie ma takiego lokalu.");
  if (!readPublicEnv().ok) back(id, "Brak konfiguracji bazy.");
  const day = String(formData.get("dzien") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) back(id, "Podaj dzień.");
  const roomRaw = String(formData.get("sala") ?? "");
  const room = roomRaw && UUID.test(roomRaw) ? roomRaw : null;
  const from = String(formData.get("od") ?? "");
  const to = String(formData.get("do") ?? "");
  const whole = formData.get("caly") === "on" || (!from && !to);
  const supabase = await createClient();
  const { error } = await supabase.rpc("oznacz_przedzial_wolny", {
    p_lokal: id,
    p_sala: room,
    p_dzien: day,
    p_od: whole ? null : from,
    p_do: whole ? null : to,
  });
  if (error) back(id, fromSupabaseError(error).detail);
  redirect(`/panel/${id}/kalendarz?dzien=${day}&info=${encodeURIComponent("Zdjęte zostały tylko blokady właściciela. Zapytanie, jeśli nachodzi, nie zostało ruszone.")}`);
}

export async function removeAvailabilityBlock(formData: FormData) {
  const id = String(formData.get("lokal") ?? "");
  const blockId = String(formData.get("id") ?? "");
  if (!UUID.test(id) || !UUID.test(blockId)) back(id || "x", "Nie ma takiej blokady.");
  if (!readPublicEnv().ok) back(id, "Brak konfiguracji bazy.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("usun_blokade", { p_id: blockId });
  if (error) back(id, fromSupabaseError(error).detail);
  redirect(`/panel/${id}/kalendarz?info=${encodeURIComponent("Blokada usunięta. Zapytanie, jeśli jest, nadal zajmuje swój termin.")}`);
}
