import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../components/chrome";
import { Shell } from "../../components/shell";
import { statusLabel } from "../../domain/rules";
import { listPending } from "../../data/supabase/owner";
import { loadSession } from "../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../data/setup";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  if (env.ok && session.profile && session.profile.rola !== "admin") {
    redirect("/panel?blad=" + encodeURIComponent("Weryfikacja jest tylko dla administratora."));
  }
  const pending = env.ok && session.profile?.rola === "admin" ? await listPending() : null;
  return (
    <Shell sharePath="/admin">
      <main className="wrap page-pad">
        <h1 className="disp">Weryfikacja lokali</h1>
        <p className="help">Publikację robi ta strona, wołając funkcję w bazie. Przeglądarka nie dostaje klucza serwisowego. Roli administratora nie nadaje się stąd.</p>
        <Flash blad={params.blad} info={params.info} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {env.ok && !session.profile ? <p><Link href="/logowanie?next=/admin">Zaloguj się</Link></p> : null}
        {pending && !pending.ok ? <p className="notice bad">{pending.detail}</p> : null}
        {pending?.ok ? (
          pending.data.length === 0 ? <p className="notice">Nie ma zgłoszeń oczekujących.</p> : (
            <table className="plain">
              <thead><tr><th>Lokal</th><th>Miasto</th><th>Status</th></tr></thead>
              <tbody>
                {pending.data.map((venue) => (
                  <tr key={venue.id}>
                    <td><Link href={`/admin/${venue.id}`}>{venue.nazwa}</Link></td>
                    <td>{venue.miasto}</td>
                    <td>{statusLabel(venue.status, venue.statusZgloszenia, venue.dirty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </main>
    </Shell>
  );
}
