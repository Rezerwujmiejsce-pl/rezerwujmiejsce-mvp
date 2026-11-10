import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_DB_URL || "";
if (!url) {
  console.error("Podaj SUPABASE_DB_URL z `supabase status -o env` (klucz DB_URL).");
  process.exit(1);
}
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
  console.error("Przykładowe lokale wolno wgrać tylko do bazy na tym komputerze.");
  process.exit(1);
}

execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", "supabase/przyklad/seed.sql"], {
  stdio: "inherit",
});
console.log(readFileSync("supabase/przyklad/CZYTAJ.txt", "utf8"));
