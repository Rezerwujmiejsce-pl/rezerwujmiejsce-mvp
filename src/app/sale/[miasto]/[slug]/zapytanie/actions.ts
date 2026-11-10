"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { inquiryProblems, inquirySuccessPath, isoDateInTimeZone } from "../../../../../domain/inquiry";
import { parsePositiveInt, safeNextPath } from "../../../../../domain/rules";
import { fromSupabaseError } from "../../../../../data/result";
import { readPublicEnv } from "../../../../../data/setup";
import { createClient } from "../../../../../data/supabase/server";

function fail(path: string, detail: string): never {
  redirect(`${path}?blad=${encodeURIComponent(detail)}`);
}

export async function sendInquiry(formData: FormData) {
  const back = safeNextPath(String(formData.get("powrot") ?? ""), "/sale");
  if (!back.startsWith("/sale/") || back.includes("?")) fail("/sale", "Nie da się wrócić do tego formularza.");
  if (!readPublicEnv().ok) fail(back, "Brak konfiguracji bazy. Uzupełnij .env.local.");
  const roomId = String(formData.get("sala") ?? "");
  const guests = parsePositiveInt(String(formData.get("goscie") ?? ""));
  const date = String(formData.get("data") ?? "");
  const time = String(formData.get("godzina") ?? "");
  const name = String(formData.get("imie") ?? "");
  const phone = String(formData.get("telefon") ?? "");
  const email = String(formData.get("email") ?? "");
  const message = String(formData.get("wiadomosc") ?? "");
  const occasion = String(formData.get("okazja") ?? "").trim();
  const venueId = String(formData.get("lokal") ?? "");
  const rooms = String(formData.get("pojemnosci") ?? "");
  const capacity = rooms
    .split(",")
    .map((pair) => pair.split(":"))
    .find(([id]) => id === roomId)?.[1];
  const problems = inquiryProblems({
    guests,
    date,
    time,
    name,
    phone,
    email,
    message,
    roomId,
    today: isoDateInTimeZone(new Date(), "Europe/Warsaw"),
    roomCapacity: capacity ? Number(capacity) : null,
  });
  if (!/^[0-9a-f-]{36}$/i.test(venueId)) problems.unshift("Brak lokalu.");
  if (problems.length) fail(back, problems[0]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("wyslij_zapytanie", {
    p_lokal: venueId,
    p_sala: roomId,
    p_okazja: occasion || null,
    p_data: date,
    p_godzina: time,
    p_goscie: guests,
    p_imie: name.trim(),
    p_telefon: phone.trim(),
    p_email: email.trim(),
    p_wiadomosc: message.trim() || null,
  });
  if (error || typeof data !== "string") fail(back, error ? fromSupabaseError(error).detail : "Nie udało się zapisać zapytania.");
  const jar = await cookies();
  jar.set("rm_zapis", data, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  redirect(inquirySuccessPath(back));
}
