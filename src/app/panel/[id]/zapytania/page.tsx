import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../../components/chrome";
import { VenueSwitcher } from "../../../../components/venue-switcher";
import { Shell } from "../../../../components/shell";
import { formatInquiryWhen, guestCountLabel, inquiryStatusLabel } from "../../../../domain/inquiry";
import { internalVenueTitle } from "../../../../domain/venues";
import { formatZloty } from "../../../../domain/rules";
import { listInquiriesForVenue } from "../../../../data/supabase/inquiries";
import { getMine, listMine } from "../../../../data/supabase/owner";
import { loadSession } from "../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../data/setup";

export default async function VenueInquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/panel/${id}/zapytania`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  if (session.profile.rola === "klient") redirect("/konto");
  const [venue, mine, rows] = await Promise.all([getMine(id), listMine(), listInquiriesForVenue(id)]);
  if (!venue.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{venue.detail}</p></main></Shell>;
  }
  if (!venue.data) notFound();
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad">
        <VenueSwitcher venues={mine.ok ? mine.data : []} currentId={id} />
        <p><Link href={`/panel/${id}`}>← {internalVenueTitle(venue.data.nazwa)}</Link></p>
        <h1 className="disp">Zapytania tego lokalu</h1>
        <p className="help">Skrzynka dotyczy tylko lokalu z adresu. Cudzy identyfikator nie otwiera listy. Potwierdzenie terminu i zadatek nie są włączone. Wstrzymanie rezerwacji nie kasuje starszych zapytań.</p>
        <Flash info={query.info} blad={query.blad} />
        {rows && !rows.ok ? <p className="notice bad">{rows.detail}</p> : null}
        {rows?.ok && rows.data.length === 0 ? <p className="box">Nie ma zapytań do tego lokalu.</p> : null}
        {rows?.ok ? rows.data.map((row) => (
          <article className="box inq" key={row.id}>
            <div>
              <h3>{inquiryStatusLabel(row.status)}</h3>
              <p>{formatInquiryWhen(row.data, row.godzina)} · {guestCountLabel(row.goscie)}{row.okazjaNazwa ? ` · ${row.okazjaNazwa}` : ""}</p>
              <p>{row.imie} · {row.telefon} · {row.email}</p>
              <p>{row.kwota != null ? `${formatZloty(row.kwota)} z cennika sali` : "Bez kwoty z cennika"}</p>
            </div>
            <div className="r">
              <Link className="btn ghost sm" href={`/panel/zapytania/${row.id}`}>Szczegóły</Link>
            </div>
          </article>
        )) : null}
      </main>
    </Shell>
  );
}
