import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../../components/chrome";
import { Shell } from "../../../../components/shell";
import { formatWarsawStamp } from "../../../../domain/admin";
import { DEPOSIT_LABEL, adminInquiryStatusLabel, formatInquiryWhen } from "../../../../domain/inquiry";
import { getVenueInquiry } from "../../../../data/supabase/inquiries";
import { loadSession } from "../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../data/setup";
import { setInquiryStatus } from "../actions";

export default async function AdminInquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/admin/zapytania/${id}`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  if (session.profile.rola !== "admin") redirect("/panel");
  const result = await getVenueInquiry(id);
  if (!result.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{result.detail}</p></main></Shell>;
  }
  if (!result.data) notFound();
  const row = result.data;
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad stack">
        <p><Link href="/admin/zapytania">← Wszystkie zapytania</Link></p>
        <Flash info={query.info} blad={query.blad} />
        <h1 className="disp">{row.lokalNazwa || "Zapytanie"}</h1>
        <p className="status-pill">{adminInquiryStatusLabel(row.status)}</p>
        <p>{formatInquiryWhen(row.data, row.godzina)}</p>
        <p>Utworzono: {formatWarsawStamp(row.utworzono)} (Europa/Warszawa)</p>
        <p>Klient: {row.imie}</p>
        <p>Okazja: {row.okazjaNazwa || "nie wybrano"}</p>
        <p>Zadatek: {DEPOSIT_LABEL}</p>
        <p className="help">Zmiana statusu nie tworzy płatności i nie wysyła wiadomości. „Potwierdzone” znaczy tylko ręcznie przyjęty termin.</p>
        <form className="form-card stack" action={setInquiryStatus}>
          <input type="hidden" name="id" value={row.id} />
          <label>Nowy status
            <select name="status" defaultValue={row.status}>
              <option value="nowe">nowe</option>
              <option value="zaakceptowane">potwierdzone, bez płatności</option>
              <option value="odrzucone">odrzucone</option>
              <option value="anulowane">anulowane</option>
              <option value="wygasle">wygasłe</option>
              <option value="inny_termin">inny termin</option>
            </select>
          </label>
          <label><input type="checkbox" name="potwierdz" value="tak" /> Potwierdzam zmianę statusu</label>
          <button className="btn" type="submit">Zapisz status</button>
        </form>
      </main>
    </Shell>
  );
}
