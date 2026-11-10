import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { estimateNote, formatInquiryWhen, guestCountLabel, inquiryStatusLabel } from "../../../domain/inquiry";
import { formatZloty } from "../../../domain/rules";
import { getOwnInquiry } from "../../../data/supabase/inquiries";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function AccountInquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/konto/${id}`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  const result = await getOwnInquiry(session.profile.id, id);
  if (!result.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{result.detail}</p></main></Shell>;
  }
  if (!result.data) notFound();
  const row = result.data;
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad konto-wrap">
        <p><Link href="/konto">← Moje rezerwacje</Link></p>
        <Flash info={query.info} blad={query.blad} />
        <p><span className={row.status === "nowe" ? "tag-wait" : "status-pill"}>{inquiryStatusLabel(row.status)}</span></p>
        <h1 className="disp">{row.lokalNazwa ?? "Lokal nie jest już opublikowany"}</h1>
        <p className="vsub">{formatInquiryWhen(row.data, row.godzina)} · {guestCountLabel(row.goscie)}{row.salaNazwa ? ` · ${row.salaNazwa}` : ""}{row.okazjaNazwa ? ` · ${row.okazjaNazwa}` : ""}</p>
        {row.zdjecie ? <img className="account-photo" src={row.zdjecie} alt="" /> : null}
        <p>{row.kwota != null ? formatZloty(row.kwota) : "Bez kwoty z cennika."} {estimateNote(row.kwota)}</p>
        {row.wiadomosc ? <p>{row.wiadomosc}</p> : null}
        <p className="help">Dane, które podałeś: {row.imie}, {row.telefon}, {row.email}.</p>
        <p className="help">Nie ma płatności, zadatku, numeru rezerwacji ani dodawania do kalendarza. Odrzucenie zapytania robi lokal, nie ten ekran.</p>
        {row.href ? <p><Link href={row.href}>Strona lokalu</Link></p> : null}
      </main>
    </Shell>
  );
}
