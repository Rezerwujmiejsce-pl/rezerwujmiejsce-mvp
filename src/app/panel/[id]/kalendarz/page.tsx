import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../../components/chrome";
import { VenueSwitcher } from "../../../../components/venue-switcher";
import { Shell } from "../../../../components/shell";
import { holdsBlock, monthGrid } from "../../../../domain/calendar";
import { internalVenueTitle } from "../../../../domain/venues";
import { listBlocks } from "../../../../data/supabase/calendar";
import { listInquiriesForVenue } from "../../../../data/supabase/inquiries";
import { getMine, listMine } from "../../../../data/supabase/owner";
import { loadSession } from "../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../data/setup";
import { addAvailabilityBlock, clearAvailabilityInterval, removeAvailabilityBlock } from "./actions";

export default async function VenueCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/panel/${id}/kalendarz`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  const [venue, mine, blocks, inquiries] = await Promise.all([
    getMine(id),
    listMine(),
    listBlocks(id),
    listInquiriesForVenue(id),
  ]);
  if (!venue.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{venue.detail}</p></main></Shell>;
  }
  if (!venue.data) notFound();
  const today = new Date();
  const [year, month] = (query.miesiac ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`).split("-").map(Number);
  const days = Number.isInteger(year) && Number.isInteger(month) ? monthGrid(year, month) : monthGrid(today.getFullYear(), today.getMonth() + 1);
  const selected = query.dzien && days.includes(query.dzien) ? query.dzien : "";
  const holds = inquiries.ok ? inquiries.data.filter((row) => holdsBlock(row.status)) : [];
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad">
        <VenueSwitcher venues={mine.ok ? mine.data : []} currentId={id} />
        <p><Link href={`/panel/${id}`}>← {internalVenueTitle(venue.data.nazwa)}</Link></p>
        <h1 className="disp">Kalendarz dostępności</h1>
        <p className="help">
          To nie jest klatka z Figmy i nie ma tu cen dnia ani pakietów. Zapytanie o statusie „nowe” zajmuje wskazaną salę do czasu odrzucenia albo do końca godzin lokalu. Nie znika samo po 24 godzinach. Odrzucone, wygasłe i „inny termin” nie blokują. „Zaakceptowane” znaczy ręcznie przyjęty termin, nie płatność. Oznaczenie „wolne” nie odwołuje zapytania.
        </p>
        <Flash info={query.info} blad={query.blad} />
        <p className="row-actions">
          <Link href={`${path}?miesiac=${prevKey}`}>Poprzedni miesiąc</Link>
          <strong>{prefix}</strong>
          <Link href={`${path}?miesiac=${nextKey}`}>Następny miesiąc</Link>
        </p>
        <div className="month" role="grid" aria-label={`Dni ${prefix}`}>
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((name) => <span key={name} className="dow">{name}</span>)}
          {days.map((day) => {
            const inMonth = day.startsWith(prefix);
            const busy = holds.some((row) => row.data === day) || (blocks.ok && blocks.data.some((block) => block.dzien === day));
            if (!inMonth) return <span key={day} className="day out" aria-hidden="true" />;
            return (
              <Link
                key={day}
                href={`${path}?miesiac=${prefix}&dzien=${day}`}
                className={day === selected ? "day on" : "day"}
                aria-current={day === selected ? "date" : undefined}
                aria-label={`${day}${busy ? ", jest zajętość" : ""}`}
              >
                {day.slice(8)}
                {busy ? <small>zajęte</small> : null}
              </Link>
            );
          })}
        </div>
        {selected ? (
          <form className="form-card fields" action={addAvailabilityBlock}>
            <h2 className="wide">Dzień {selected}</h2>
            <input type="hidden" name="lokal" value={id} />
            <input type="hidden" name="dzien" value={selected} />
            <label>Sala
              <select name="sala" defaultValue="">
                <option value="">Cały lokal</option>
                {venue.data.sale.map((room) => <option key={room.id} value={room.id}>{room.nazwa || "Sala"}</option>)}
              </select>
            </label>
            <label>Od<input name="od" type="time" defaultValue={venue.data.godzinyOd || "12:00"} /></label>
            <label>Do<input name="do" type="time" defaultValue={venue.data.godzinyDo || "23:00"} /></label>
            <label className="wide"><input type="checkbox" name="caly" /> Cały dzień w godzinach lokalu</label>
            <label className="wide"><input type="checkbox" name="soboty" /> Te same godziny we wszystkie soboty tego miesiąca</label>
            <label className="wide">Notatka wewnętrzna<input name="notatka" maxLength={200} /></label>
            <div className="wide row-actions">
              <button className="btn" type="submit">Zablokuj termin</button>
            </div>
          </form>
        ) : <p className="help">Wybierz dzień linkiem. Działa z klawiatury. Przeciąganie nie jest potrzebne.</p>}
        {selected ? (
          <form className="form-card fields" action={clearAvailabilityInterval}>
            <h2 className="wide">Oznacz przedział jako wolny</h2>
            <p className="help wide">Kasuje tylko blokady właściciela w tym przedziale. Jeśli nachodzi zapytanie albo przyjęty termin, baza odmawia i nie rusza zapytania.</p>
            <input type="hidden" name="lokal" value={id} />
            <input type="hidden" name="dzien" value={selected} />
            <label>Sala
              <select name="sala" defaultValue="">
                <option value="">Cały lokal</option>
                {venue.data.sale.map((room) => <option key={room.id} value={room.id}>{room.nazwa || "Sala"}</option>)}
              </select>
            </label>
            <label>Od<input name="od" type="time" defaultValue={venue.data.godzinyOd || "12:00"} /></label>
            <label>Do<input name="do" type="time" defaultValue={venue.data.godzinyDo || "23:00"} /></label>
            <label className="wide"><input type="checkbox" name="caly" /> Cały dzień w godzinach lokalu</label>
            <div className="wide"><button className="btn ghost" type="submit">Oznacz jako wolne</button></div>
          </form>
        ) : null}
        {!blocks.ok ? <p className="notice bad">{blocks.detail}</p> : null}
        {!inquiries.ok ? <p className="notice bad">{inquiries.detail}</p> : null}
        <h2>Blokady</h2>
        {blocks.ok && blocks.data.length === 0 ? <p>Brak blokad właściciela.</p> : null}
        {blocks.ok ? blocks.data.map((block) => (
          <form key={block.id} action={removeAvailabilityBlock} className="row-actions">
            <input type="hidden" name="lokal" value={id} />
            <input type="hidden" name="id" value={block.id} />
            <span>{block.dzien} · {block.salaId ? "sala" : "cały lokal"} · {block.od && block.doo ? `${block.od}–${block.doo}` : "godziny lokalu"}</span>
            <button className="btn ghost sm" type="submit">Usuń blokadę</button>
          </form>
        )) : null}
        <h2>Zapytania, które zajmują termin</h2>
        {holds.length === 0 ? <p>Brak zapytań zajmujących termin.</p> : null}
        {holds.map((row) => (
          <p key={row.id}>
            <Link href={`/panel/${id}/zapytania`}>{row.data} {row.godzina.slice(0, 5)}</Link>
            {" · "}{row.status === "zaakceptowane" ? "termin zaakceptowany, bez płatności" : "zapytanie wstępne"}
            {row.okazjaNazwa ? ` · ${row.okazjaNazwa}` : ""}
          </p>
        ))}
      </main>
    </Shell>
  );
}
