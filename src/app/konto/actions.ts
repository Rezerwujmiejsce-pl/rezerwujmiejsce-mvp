"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "../../domain/rules";
import { fromSupabaseError } from "../../data/result";
import { readPublicEnv } from "../../data/setup";
import { createClient } from "../../data/supabase/server";

function fail(path: string, detail: string): never {
  redirect(`${path}?blad=${encodeURIComponent(detail)}`);
}

export async function signIn(formData: FormData) {
  if (!readPublicEnv().ok) fail("/logowanie", "Brak konfiguracji bazy. Uzupełnij .env.local.");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/panel"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/logowanie", "Nie udało się zalogować. Sprawdź adres i hasło.");
  redirect(next);
}

export async function signUp(formData: FormData) {
  if (!readPublicEnv().ok) fail("/rejestracja", "Brak konfiguracji bazy. Uzupełnij .env.local.");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("imie") ?? "").trim();
  const phone = String(formData.get("telefon") ?? "").trim();
  if (password.length < 8) fail("/rejestracja", "Hasło musi mieć przynajmniej 8 znaków.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { imie_nazwisko: name } },
  });
  if (error) fail("/rejestracja", "Nie udało się założyć konta. Jeśli adres jest zajęty, zaloguj się.");
  if (!data.session) {
    redirect("/logowanie?info=" + encodeURIComponent("Potwierdź adres e-mail, a potem zaloguj się. Prowadzenie lokalu włączysz przyciskiem na stronie rejestracji po zalogowaniu."));
  }
  const role = await supabase.rpc("zostan_wlascicielem");
  if (role.error) fail("/rejestracja", fromSupabaseError(role.error).detail);
  if (name || phone) {
    await supabase.from("profile").update({
      imie_nazwisko: name || null,
      telefon: phone || null,
    }).eq("id", data.user?.id ?? "");
  }
  redirect("/panel");
}

export async function becomeOwner() {
  if (!readPublicEnv().ok) fail("/logowanie", "Brak konfiguracji bazy.");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie?next=/rejestracja");
  const { error } = await supabase.rpc("zostan_wlascicielem");
  if (error) fail("/rejestracja", fromSupabaseError(error).detail);
  redirect("/panel");
}

export async function signOut() {
  if (readPublicEnv().ok) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
