import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const email = process.argv[2] || process.env.ADMIN_EMAIL || "";

if (!url || !key || !email) {
  console.error("Użycie: ADMIN_EMAIL=osoba@poczta SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npm run admin:bootstrap");
  console.error("Albo: npm run admin:bootstrap -- osoba@poczta");
  console.error("Klucza service role nie wklejaj do przeglądarki i nie commituj.");
  process.exit(1);
}

const host = new URL(url).hostname;
const local = host === "127.0.0.1" || host === "localhost";
if (!local && process.env.ALLOW_REMOTE_BOOTSTRAP !== "yes") {
  console.error("Adres nie jest lokalny. Zdalny DEV wymaga świadomej zgody: ALLOW_REMOTE_BOOTSTRAP=yes");
  console.error("Ten agent nie łączy się z projektem uksiphxyrpanubfjixhg sam z siebie.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("bootstrap_admin", { p_email: email });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`Nadano rolę administratora kontu ${email}. Id: ${data}`);
console.log("Osoba musi wylogować się i zalogować ponownie, jeśli miała otwartą sesję.");
