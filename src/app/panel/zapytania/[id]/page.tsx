import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../../components/chrome";
import { Shell } from "../../../../components/shell";
import { estimateNote, formatInquiryWhen, inquiryStatusLabel } from "../../../../domain/inquiry";
import { formatZloty } from "../../../../domain/rules";
import { getVenueInquiry } from "../../../../data/supabase/inquiries";
import { loadSession } from "../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../data/setup";
import { rejectInquiry } from "../actions";

export default async function OwnerInquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/panel/zapytania/${id}`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  if (session.profile.rola === "klient") redirect("/konto");
  const result = await getVenueInquiry(id);
  if (!result.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{result.detail}</p></main></Shell>;
  }
  if (!result.data) notFound();
  const row = result.data;
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad">
        <p><Link href="/panel/zapytania">← Zapytania</Link></p>
        <Flash info={query.info} blad={query.blad} />
        <h1 className="disp">{row.lokalNazwa ?? "Zapytanie"}</h1>
        <p><span className="status-pill">{inquiryStatusLabel(row.status)}</span></p>
        <div className="box">
          <p>{formatInquiryWhen(row.data, row.godzina)}</p>
          <p>{row.goscie} osób{row.salaNazwa ? ` · sala ${row.salaNazwa}` : ""}{row.okazjaNazwa ? ` · ${row.okazjaNazwa}` : ""}</p>
          <p><b>{row.imie}</b><br />{row.telefon}<br />{row.email}</p>
          {row.wiadomosc ? <p>{row.wiadomosc}</p> : <p className="help">Bez dodatkowej wiadomości.</p>}
          <p>{row.kwota != null ? formatZloty(row.kwota) : "Bez kwoty."} {estimateNote(row.kwota)}</p>
          {row.href ? <p><Link href={row.href}>Opublikowana strona lokalu</Link></p> : <p className="help">Lokal nie ma teraz opublikowanej strony.</p>}
        </div>
        {row.status === "nowe" ? (
          <form action={rejectInquiry} className="row-actions">
            <input type="hidden" name="id" value={row.id} />
            <button className="btn" type="submit">Odrzuć zapytanie</button>
          </form>
        ) : null}
        <p className="help">Potwierdzenie terminu, propozycja innej daty, zadatek i rezerwacja nie są włączone. Nie wysyłamy z tego ekranu SMS-a ani e-maila.</p>
      </main>
    </Shell>
  );
}
