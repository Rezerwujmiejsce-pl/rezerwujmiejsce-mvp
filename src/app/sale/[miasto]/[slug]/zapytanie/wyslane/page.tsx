import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InquirySteps } from "../../../../../../components/inquiry-steps";
import { Shell } from "../../../../../../components/shell";
import { inquirySuccessCopy } from "../../../../../../domain/inquiry";
import { getPublishedVenue } from "../../../../../../data/supabase/catalog";
import { loadSession } from "../../../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../../../data/setup";
import { createClient } from "../../../../../../data/supabase/server";

export default async function InquirySentPage({
  params,
}: {
  params: Promise<{ miasto: string; slug: string }>;
}) {
  const { miasto, slug } = await params;
  const path = `/sale/${miasto}/${slug}/zapytanie/wyslane`;
  const env = readPublicEnv();
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
  const jar = await cookies();
  const token = jar.get("rm_zapis")?.value ?? "";
  let confirmed = false;
  if (env.ok && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("czy_swieze_zapytanie", { p_id: token });
    confirmed = !error && data === true;
  }
  const copy = inquirySuccessCopy(confirmed, confirmed && venue?.ok ? venue.data?.nazwa ?? null : null);
  return (
    <Shell sharePath={path}>
      <main className="page">
        <div className="wrap">
          {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
          <InquirySteps stage={confirmed ? "saved" : "form"} />
          <div className="okbox">
            <div className="dot" aria-hidden="true">{confirmed ? "✓" : "?"}</div>
            <h1>{copy.title}</h1>
            <p>{copy.body}</p>
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
