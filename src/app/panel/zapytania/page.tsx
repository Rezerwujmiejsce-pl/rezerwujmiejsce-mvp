import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { formatInquiryWhen, inquiryStatusLabel } from "../../../domain/inquiry";
import { formatZloty } from "../../../domain/rules";
import { listVenueInquiries } from "../../../data/supabase/inquiries";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function OwnerInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  if (env.ok && !session.profile) redirect("/logowanie?next=/panel/zapytania");
  const rows = env.ok && session.profile && session.profile.rola !== "klient" ? await listVenueInquiries() : null;
  return (
    <Shell sharePath="/panel/zapytania">
      <main className="wrap page-pad">
        <p><Link href="/panel">← Twoje lokale</Link></p>
        <div className="subhead">
          <div>
            <h1 className="disp">Zapytania</h1>
            <p className="help">To wiadomości o terminie. Potwierdzenie, inna data, zadatek i rezerwacja nie są włączone. Możesz odrzucić zapytanie.</p>
          </div>
        </div>
        <Flash info={params.info} blad={params.blad} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {session.profile?.rola === "klient" ? (
          <p className="notice">To konto nie prowadzi lokalu. Swoje zapytania zobaczysz na <Link href="/konto">koncie</Link>.</p>
        ) : null}
        {rows && !rows.ok ? <p className="notice bad">{rows.detail}</p> : null}
        {rows?.ok && rows.data.length === 0 ? <p className="box">Nie ma zapytań do Twoich lokali.</p> : null}
        {rows?.ok ? rows.data.map((row) => (
          <article className="box inq" key={row.id}>
            <div>
              <h3>
                {row.lokalNazwa ?? "Lokal"}
                <span className="status-pill">{inquiryStatusLabel(row.status)}</span>
              </h3>
              <p>{formatInquiryWhen(row.data, row.godzina)} · {row.goscie} osób{row.okazjaNazwa ? ` · ${row.okazjaNazwa}` : ""}</p>
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
