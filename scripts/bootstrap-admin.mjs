import { execFileSync } from "node:child_process";

const url = process.env.SUPABASE_DB_URL || "";
const email = process.argv[2] || process.env.ADMIN_EMAIL || "";

if (!url || !email) {
  console.error("Użycie: SUPABASE_DB_URL='postgresql://postgres:...@127.0.0.1:54322/postgres' npm run admin:bootstrap -- osoba@poczta");
  console.error("Adres bazy jest w `supabase status -o env` jako DB_URL.");
  console.error("To nie jest wywołanie RPC. Funkcji bootstrap nie ma w publicznym API.");
  process.exit(1);
}

let host = "";
try {
  host = new URL(url).hostname;
} catch {
  console.error("SUPABASE_DB_URL nie jest adresem postgres.");
  process.exit(1);
}

const local = host === "127.0.0.1" || host === "localhost";
if (!local && process.env.ALLOW_REMOTE_BOOTSTRAP !== "yes") {
  console.error("Adres nie jest lokalny. Zdalny DEV wymaga świadomej zgody: ALLOW_REMOTE_BOOTSTRAP=yes");
  process.exit(1);
}

execFileSync(
  "psql",
  [url, "-v", "ON_ERROR_STOP=1", "-v", `admin_email=${email}`, "-c", "select private.bootstrap_admin(:'admin_email');"],
  { stdio: "inherit" },
);
console.log(`Nadano rolę administratora kontu ${email}.`);
console.log("Osoba musi wylogować się i zalogować ponownie, jeśli miała otwartą sesję.");
