"use server";

import { redirect } from "next/navigation";
import { homeProblems } from "../../../domain/home";
import { fromSupabaseError } from "../../../data/result";
import { readPublicEnv } from "../../../data/setup";
import { createClient } from "../../../data/supabase/server";

function fail(detail: string): never {
  redirect(`/admin/strona?blad=${encodeURIComponent(detail)}`);
}

function readPayload(formData: FormData) {
  const naglowek = String(formData.get("naglowek") ?? "");
  const podtytul = String(formData.get("podtytul") ?? "");
  const baner = String(formData.get("baner") ?? "");
  const problems = homeProblems({ naglowek, podtytul, baner });
  let okazje: unknown;
  try {
    okazje = JSON.parse(String(formData.get("okazje") ?? "[]"));
  } catch {
    problems.push("Lista okazji jest nieprawidłowa.");
  }
  if (!Array.isArray(okazje)) problems.push("Lista okazji jest nieprawidłowa.");
  return { naglowek: naglowek.trim(), podtytul: podtytul.trim(), baner, okazje, problems };
}

async function client() {
  if (!readPublicEnv().ok) fail("Brak konfiguracji bazy.");
  return createClient();
}

export async function saveHome(formData: FormData) {
  const payload = readPayload(formData);
  if (payload.problems.length) fail(payload.problems[0]);
  const supabase = await client();
  const { error } = await supabase.rpc("zapisz_strone", {
    p_naglowek: payload.naglowek,
    p_podtytul: payload.podtytul,
    p_baner: payload.baner,
    p_okazje: payload.okazje,
  });
  if (error) fail(fromSupabaseError(error).detail);
  redirect("/admin/strona?info=" + encodeURIComponent("Szkic zapisany. Strona publiczna się nie zmieniła."));
}

export async function publishHome(formData: FormData) {
  const payload = readPayload(formData);
  if (payload.problems.length) fail(payload.problems[0]);
  const supabase = await client();
  const saved = await supabase.rpc("zapisz_strone", {
    p_naglowek: payload.naglowek,
    p_podtytul: payload.podtytul,
    p_baner: payload.baner,
    p_okazje: payload.okazje,
  });
  if (saved.error) fail(fromSupabaseError(saved.error).detail);
  const published = await supabase.rpc("opublikuj_strone");
  if (published.error) fail(fromSupabaseError(published.error).detail);
  redirect("/admin/strona?info=" + encodeURIComponent("Opublikowano tekst strony głównej."));
}
