import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { statusLabel } from "../../../domain/rules";
import { getMine } from "../../../data/supabase/owner";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";
import { approveVenue, archiveVenue, rejectVenue, restoreSuspendedVenue, suspendVenue } from "../actions";

export default async function AdminVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={`/admin/${id}`}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=/admin/${id}`);
  if (session.profile.rola !== "admin") redirect("/panel");
  const venue = await getMine(id);
  if (!venue.ok) {
    return <Shell sharePath={`/admin/${id}`}><main className="wrap page-pad"><p className="notice bad">{venue.detail}</p></main></Shell>;
  }
  if (!venue.data) notFound();
  const data = venue.data;
  return (
    <Shell sharePath={`/admin/${id}`}>
      <main className="wrap page-pad stack">
        <p><Link href="/admin">← Zgłoszenia</Link></p>
        <Flash info={query.info} blad={query.blad} />
        <h1 className="disp">{data.nazwa || "Lokal"}</h1>
        <p className="status-pill">{statusLabel(data.status, data.statusZgloszenia, data.dirty)}</p>
        {data.status === "published" ? <p className="notice">Goście nadal widzą poprzednią zaakceptowaną wersję, dopóki nie klikniesz „Publikuj”.</p> : null}
        <section className="form-card">
          <p>{data.miasto}{data.dzielnica ? ` · ${data.dzielnica}` : ""} · {data.adres}</p>
          <p>{data.opis || "Brak opisu."}</p>
          <p>Okazje: {data.okazje.join(", ") || "brak"}</p>
          <p>Udogodnienia: {data.udogodnienia.map((item) => item.kod).join(", ") || "brak"}</p>
          <h2>Sale</h2>
          <ul>
            {data.sale.map((room) => (
              <li key={room.id}>
                {room.nazwa || "Bez nazwy"} · {room.widoczna ? "widoczna" : "ukryta"} · goście: {room.pojemnosc ?? "—"} ·{" "}
                {room.cenaNaZapytanie ? "cena na zapytanie" : room.kwotaGrosze != null ? `${(room.kwotaGrosze / 100).toLocaleString("pl-PL")} zł` : "brak ceny"} {room.jednostkaCeny}
              </li>
            ))}
          </ul>
          <h2>Kontakt niewidoczny na stronie</h2>
          <p>{data.emailKontaktowy || "brak e-maila"} · {data.telefonWewnetrzny || "brak telefonu wewnętrznego"}</p>
          {data.notatka ? <p>{data.notatka}</p> : null}
          <p>Telefon publiczny: {data.telefonPubliczny || "brak"}</p>
          <h2>Zdjęcia w kopii roboczej</h2>
          <div className="feats">
            {data.zdjecia.map((photo) => (
              <img key={photo.id} src={`/media/${photo.sciezka}`} alt={photo.podpis ?? ""} width={160} height={110} />
            ))}
          </div>
        </section>
        <form className="row-actions" action={approveVenue}>
          <input type="hidden" name="id" value={data.id} />
          <button className="btn" type="submit">Publikuj</button>
        </form>
        <form className="form-card stack" action={rejectVenue}>
          <input type="hidden" name="id" value={data.id} />
          <label>Powód odrzucenia<textarea name="powod" required placeholder="Co właściciel ma poprawić?" /></label>
          <button className="btn ghost" type="submit">Odrzuć</button>
        </form>
        {data.status === "published" ? (
          <form className="stack" action={suspendVenue}>
            <input type="hidden" name="id" value={data.id} />
            <label><input type="checkbox" name="potwierdz" value="tak" /> Zawieś lokal i schowaj stronę publiczną</label>
            <button className="btn ghost" type="submit">Zawieś</button>
          </form>
        ) : null}
        {data.status === "suspended" ? (
          <form className="stack" action={restoreSuspendedVenue}>
            <input type="hidden" name="id" value={data.id} />
            <p className="help">Przywrócenie wkłada tylko poprzednią publikację. Szkic zostaje szkicem.</p>
            <label><input type="checkbox" name="potwierdz" value="tak" /> Przywróć poprzednią publikację</label>
            <button className="btn" type="submit">Przywróć publikację</button>
          </form>
        ) : null}
        <form action={archiveVenue}>
          <input type="hidden" name="id" value={data.id} />
          <button className="btn ghost" type="submit">Ukryj lokal</button>
        </form>
      </main>
    </Shell>
  );
}
