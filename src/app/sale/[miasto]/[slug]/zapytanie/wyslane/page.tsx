import Link from "next/link";
import { notFound } from "next/navigation";
import { InquirySteps } from "../../../../../../components/inquiry-steps";
import { Shell } from "../../../../../../components/shell";
import { getPublishedVenue } from "../../../../../../data/supabase/catalog";
import { loadSession } from "../../../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../../../data/setup";

export default async function InquirySentPage({
  params,
  searchParams,
}: {
  params: Promise<{ miasto: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { miasto, slug } = await params;
  const query = await searchParams;
  const env = readPublicEnv();
  const saved = query.zapis === "1" && env.ok;
  const path = `/sale/${miasto}/${slug}/zapytanie/wyslane`;
  const session = env.ok ? await loadSession() : null;
  const venue = env.ok ? await getPublishedVenue(decodeURIComponent(miasto), decodeURIComponent(slug)) : null;
  if (venue && !venue.ok) {
    return (
      <Shell sharePath={path}>
        <main className="page"><div className="wrap page-pad"><p className="notice bad">{venue.detail}</p></div></main>
      </Shell>
    );
  }
  if (venue?.ok && !venue.data) notFound();
  const name = venue?.ok ? venue.data?.nazwa : null;
  return (
    <Shell sharePath={path}>
      <main className="page">
        <div className="wrap">
          {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
          <InquirySteps stage={saved ? "saved" : "form"} />
          <div className="okbox">
            <div className="dot" aria-hidden="true">✓</div>
            <h1>{saved ? "Zapytanie jest w portalu" : "Potwierdzenie po zapisie"}</h1>
            <p>
              {saved
                ? `${name ? `Zapisaliśmy zapytanie do lokalu ${name}. ` : "Zapisaliśmy zapytanie. "}Lokal zobaczy je u siebie w panelu. Nie wysłaliśmy SMS-a ani e-maila. To nie jest rezerwacja, nie ma zadatku i termin nie jest potwierdzony.`
                : "Ten adres otwiera się po wysłaniu formularza. Samo wejście tutaj nie zapisuje zapytania i nie wysyła wiadomości."}
            </p>
            <div className="row-btns">
              {session?.profile ? <Link className="btn" href="/konto">Zobacz konto</Link> : <Link className="btn" href="/logowanie?next=/konto">Zaloguj się, żeby widzieć kolejne</Link>}
              <Link className="btn ghost" href={`/sale/${miasto}/${slug}`}>Wróć do lokalu</Link>
            </div>
            {session?.profile ? null : (
              <p className="help">To wysłane bez logowania zapytanie nie pojawi się samo na koncie, nawet przy tym samym e-mailu.</p>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
