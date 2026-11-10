import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "../setup";

export async function createClient() {
  const env = readPublicEnv();
  if (!env.ok) {
    throw new Error("UNCONFIGURED");
  }
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Zapis ciastek w komponencie serwerowym robi middleware.
        }
      },
    },
  });
}
