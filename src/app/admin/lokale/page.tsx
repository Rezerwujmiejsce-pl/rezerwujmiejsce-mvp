import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { formatWarsawStamp } from "../../../domain/admin";
import { lifecycleGroup } from "../../../domain/venues";
import { statusLabel } from "../../../domain/rules";
import { listAdminVenues } from "../../../data/supabase/admin";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";
import { restoreSuspendedVenue, suspendVenue } from "../actions";

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath="/admin/lokale"><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect("/logowanie?next=/admin/lokale");
  if (session.profile.rola !== "admin") redirect("/panel");
  const listed = await listAdminVenues(query);
  const page = listed.ok ? listed.data.page : 1;
  const city = query.miasto ?? "";
  const status = query.status ?? "";
  const href = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (city) params.set("miasto", city);
    if (nextPage > 1) params.set("strona", String(nextPage));
    const text = params.toString();
    return text ? `/admin/lokale?${text}` : "/admin/lokale";
  };
  return (
    <Shell sharePath="/admin/lokale">
      <main className="wrap page-pad">
        <p><Link href="/admin">← Weryfikacja</Link></p>
        <h1 className="disp">Wszystkie lokale</h1>
        <p className="help">
          Było: lista tylko zgłoszeń czekających na sprawdzenie. Dodano: tabela wszystkich lokali.
          Zawieszenie chowa stronę i zostawia poprzednią publikację. Przywrócenie wkłada tylko tamtą publikację, nie szkic.
          Szkic, odrzucenie i wycofanie zostają osobnymi statusami. To nie jest klatka z Figmy.
        </p>
        <Flash info={query.info} blad={query.blad} />
        <form className="row-actions" method="get">
          <label>Status
            <select name="status" defaultValue={status}>
              <option value="">Wszystkie</option>
              <option value="draft">szkic</option>
              <option value="pending_review">do weryfikacji</option>
              <option value="published">aktywny</option>
              <option value="suspended">zawieszony</option>
              <option value="rejected">odrzucony</option>
              <option value="archived">wycofany</option>
            </select>
          </label>
          <label>Miasto<input name="miasto" defaultValue={city} /></label>
          <button className="btn sm" type="submit">Filtruj</button>
        </form>
        {!listed.ok ? <p className="notice bad">{listed.detail}</p> : null}
        {listed.ok && listed.data.rows.length === 0 ? <p>Brak lokali dla tego filtra.</p> : null}
        {listed.ok && listed.data.rows.length > 0 ? (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr><th>Nazwa</th><th>Właściciel</th><th>Miasto</th><th>Status</th><th>Utworzono</th><th>Działania</th></tr>
              </thead>
              <tbody>
                {listed.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.nazwa}</td>
                    <td>{row.wlasciciel}</td>
                    <td>{row.miasto}</td>
                    <td>{lifecycleGroup(row.status)} · {statusLabel(row.status, row.statusZgloszenia, false)}</td>
                    <td>{formatWarsawStamp(row.utworzono)}</td>
                    <td className="row-actions">
                      {row.status === "published" && row.slug ? (
                        <Link href={`/sale/${row.miastoNorm}/${row.slug}`}>Podgląd</Link>
                      ) : <span>Strona ukryta</span>}
                      <Link href={`/admin/${row.id}`}>Edycja</Link>
                      {row.status === "published" ? (
                        <form action={suspendVenue}>
                          <input type="hidden" name="id" value={row.id} />
                          <label><input type="checkbox" name="potwierdz" value="tak" /> Zawieś</label>
                          <button className="btn ghost sm" type="submit">Zawieś</button>
                        </form>
                      ) : null}
                      {row.status === "suspended" ? (
                        <form action={restoreSuspendedVenue}>
                          <input type="hidden" name="id" value={row.id} />
                          <label><input type="checkbox" name="potwierdz" value="tak" /> Przywróć publikację</label>
                          <button className="btn ghost sm" type="submit">Przywróć</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {listed.ok && listed.data.pages > 1 ? (
          <p className="row-actions">
            {page > 1 ? <Link href={href(page - 1)}>Poprzednia</Link> : null}
            <span>Strona {page} z {listed.data.pages}</span>
            {page < listed.data.pages ? <Link href={href(page + 1)}>Następna</Link> : null}
          </p>
        ) : null}
      </main>
    </Shell>
  );
}
