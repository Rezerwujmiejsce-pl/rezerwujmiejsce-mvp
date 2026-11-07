import { readPublicEnv, type Setup } from "../setup";
import { createClient } from "./server";

export type ProfileRow = {
  id: string;
  rola: "klient" | "wlasciciel" | "admin";
  imie_nazwisko: string | null;
  email: string | null;
  telefon: string | null;
};

export async function loadSession(): Promise<{
  env: Setup;
  profile: ProfileRow | null;
  unreachable: boolean;
}> {
  const env = readPublicEnv();
  if (!env.ok) return { env, profile: null, unreachable: false };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { env, profile: null, unreachable: false };
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id, rola, imie_nazwisko, email, telefon")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) return { env, profile: null, unreachable: true };
    return { env, profile: profile as ProfileRow | null, unreachable: false };
  } catch {
    return { env, profile: null, unreachable: true };
  }
}
