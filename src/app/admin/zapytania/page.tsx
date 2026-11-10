import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { formatWarsawStamp } from "../../../domain/admin";
import { DEPOSIT_LABEL, adminInquiryStatusLabel, formatInquiryWhen } from "../../../domain/inquiry";
import { listAdminInquiries, listVenueChoices } from "../../../data/supabase/admin";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath="/admin/zapytania"><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect("/logowanie?next=/admin/zapytania");
  if (session.profile.rola !== "admin") redirect("/panel");
  const [listed, venues] = await Promise.all([
    listAdminInquiries({ status: query.status, venue: query.lokal, date: query.data, page: query.strona }),
    listVenueChoices(),
  ]);
  const page = listed.ok ? listed.data.page : 1;
  const href = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.lokal) params.set("lokal", query.lokal);
    if (query.data) params.set("data", query.data);
    if (nextPage > 1) params.set("strona", String(nextPage));
    const text = params.toString();
    return text ? `/admin/zapytania?${text}` : "/admin/zapytania";
  };
  return (
    <Shell sharePath="/admin/zapytania">
      <main className="wrap page-pad">
        <p><Link href="/admin">← Weryfikacja</Link></p>
        <h1 className="disp">Wszystkie zapytania</h1>
        <p className="help">
          Było: właściciel widzi zapytania swojego lokalu. Dodano: lista administratora.
          „Potwierdzone” to ręcznie przyjęty termin, nie opłacona rezerwacja. Zadatek: {DEPOSIT_LABEL}.
          Data terminu jest dniem kalendarza. Czas utworzenia jest w Europie/Warszawie. Strona ma najwyżej 20 wierszy.
        </p>
        <Flash info={query.info} blad={query.blad} />
        <form className="row-actions" method="get">
          <label>Status
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">Wszystkie</option>
              <option value="nowe">nowe</option>
              <option value="zaakceptowane">potwierdzone</option>
              <option value="odrzucone">odrzucone</option>
              <option value="anulowane">anulowane</option>
              <option value="wygasle">wygasłe</option>
              <option value="inny_termin">inny termin</option>
            </select>
          </label>
          <label>Lokal
            <select name="lokal" defaultValue={query.lokal ?? ""}>
              <option value="">Wszystkie</option>
              {venues.ok ? venues.data.map((venue) => <option key={venue.id} value={venue.id}>{venue.nazwa}</option>) : null}
            </select>
          </label>
          <label>Data terminu<input type="date" name="data" defaultValue={query.data ?? ""} /></label>
          <button className="btn sm" type="submit">Filtruj</button>
        </form>
        {!listed.ok ? <p className="notice bad">{listed.detail}</p> : null}
        {listed.ok && listed.data.rows.length === 0 ? <p>Brak zapytań dla tego filtra.</p> : null}
        {listed.ok && listed.data.rows.length > 0 ? (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr><th>Data</th><th>Lokal</th><th>Właściciel</th><th>Klient</th><th>Okazja</th><th>Status</th><th>Zadatek</th></tr>
              </thead>
              <tbody>
                {listed.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/zapytania/${row.id}`}>{formatInquiryWhen(row.data, row.godzina)}</Link>
                      <br /><small>utworzono {formatWarsawStamp(row.utworzono)}</small>
                    </td>
                    <td>{row.lokalNazwa || "Lokal"}</td>
                    <td>{row.wlasciciel}</td>
                    <td>{row.imie}</td>
                    <td>{row.okazjaNazwa || "—"}</td>
                    <td>{adminInquiryStatusLabel(row.status)}</td>
                    <td>{DEPOSIT_LABEL}</td>
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
