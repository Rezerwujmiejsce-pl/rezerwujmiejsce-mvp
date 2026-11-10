import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { HomeEditor } from "../../../components/home-editor";
import { Shell } from "../../../components/shell";
import { HOME_DEFAULTS } from "../../../domain/home";
import { listOccasions } from "../../../data/supabase/catalog";
import { loadHomeDraft } from "../../../data/supabase/home";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function HomeAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  if (env.ok && !session.profile) redirect("/logowanie?next=/admin/strona");
  if (env.ok && session.profile && session.profile.rola !== "admin") {
    redirect("/panel?blad=" + encodeURIComponent("Stronę główną zmienia tylko administrator."));
  }
  const [draft, occasions] = env.ok && session.profile?.rola === "admin"
    ? await Promise.all([loadHomeDraft(), listOccasions()])
    : [null, null];
  const copy = draft?.ok ? draft.data.publication : null;
  return (
    <Shell sharePath="/admin/strona">
      <main className="wrap page-pad">
        <p><Link href="/admin">← Weryfikacja lokali</Link></p>
        <h1 className="disp">Strona główna</h1>
        <p className="help">Tu są nagłówek, podtytuł, baner i kafle okazji. Lista lokali na stronie głównej zostaje wynikiem wyszukiwania opublikowanych miejsc w Zielonej Górze. Nie ma osobnego modułu wyróżnionych lokali. Szkic nie jest publiczny.</p>
        <Flash info={params.info} blad={params.blad} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {draft?.ok && draft.data.missing ? (
          <p className="notice">Tabela strony nie jest jeszcze w bazie. Publiczna strona zostaje przy dotychczasowym tekście. Najpierw wgraj migrację strony głównej.</p>
        ) : null}
        {draft && !draft.ok ? <p className="notice bad">{draft.detail}</p> : null}
        {occasions && !occasions.ok ? <p className="notice bad">{occasions.detail}</p> : null}
        {draft?.ok && !draft.data.missing && occasions?.ok ? (
          <HomeEditor
            naglowek={copy?.naglowek ?? HOME_DEFAULTS.naglowek}
            podtytul={copy?.podtytul ?? HOME_DEFAULTS.podtytul}
            baner={copy?.baner ?? HOME_DEFAULTS.baner}
            occasions={occasions.data}
            settings={copy?.kafle ?? []}
          />
        ) : null}
      </main>
    </Shell>
  );
}
