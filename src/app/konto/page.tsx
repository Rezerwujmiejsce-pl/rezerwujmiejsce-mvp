import Link from "next/link";
import { AccountCard } from "../../components/account-card";
import { Flash } from "../../components/chrome";
import { Shell } from "../../components/shell";
import { firstName } from "../../domain/inquiry";
import { listOwnInquiries } from "../../data/supabase/inquiries";
import { loadSession } from "../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../data/setup";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  const rows = env.ok && session.profile ? await listOwnInquiries(session.profile.id) : null;
  const name = firstName(session.profile?.imie_nazwisko ?? null);
  const own = rows?.ok ? rows.data : [];
  const pending = rows?.ok ? rows.data.filter((row) => row.status === "nowe") : [];
  const finished = rows?.ok ? rows.data.filter((row) => row.status !== "nowe") : [];
  return (
    <Shell sharePath="/konto">
      <main className="wrap page-pad konto-wrap">
        <h1 className="disp">Moje rezerwacje</h1>
        <p className="vsub">
          {name ? `Cześć ${name}! ` : ""}
          Tu są zapytania wysłane po zalogowaniu na to konto. Zadatek i potwierdzony termin nie działają, więc nie ma kart płatności ani kalendarza.
        </p>
        <Flash info={params.info} blad={params.blad} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {env.ok && !session.profile ? (
          <p>Żeby zobaczyć swoje zapytania, <Link href="/logowanie?next=/konto">zaloguj się</Link>.</p>
        ) : null}
        {rows && !rows.ok ? <p className="notice bad">{rows.detail}</p> : null}
        {rows?.ok && own.length === 0 ? (
          <div className="box">
            <h2>Brak zapytań</h2>
            <p>Nie ma zapytań powiązanych z tym kontem. Formularz wysłany bez logowania nie dopisuje się tutaj po adresie e-mail ani telefonie.</p>
            <Link className="btn" href="/sale">Przeglądaj sale</Link>
          </div>
        ) : null}
        {pending.map((row) => <AccountCard key={row.id} row={row} />)}
        {finished.length ? <h2 className="st">Odrzucone i inne zakończone</h2> : null}
        {finished.map((row) => <AccountCard key={row.id} row={row} />)}
        {session.profile?.rola === "klient" ? (
          <p className="help">Prowadzenie lokalu jest osobno. <Link href="/rejestracja">Dodaj swój lokal</Link>, jeśli chcesz przyjmować zapytania.</p>
        ) : session.profile ? (
          <p className="help">Zapytania do Twoich lokali są w <Link href="/panel/zapytania">panelu lokalu</Link>, nie na tym koncie.</p>
        ) : null}
      </main>
    </Shell>
  );
}
