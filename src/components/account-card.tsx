import Link from "next/link";
import { estimateNote, formatInquiryWhen, guestCountLabel, inquiryStatusLabel } from "../domain/inquiry";
import { formatZloty } from "../domain/rules";
import type { InquiryRecord } from "../data/supabase/inquiries";

export function AccountCard({ row }: { row: InquiryRecord }) {
  const sent = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(row.utworzono));
  const title = [row.okazjaNazwa, row.lokalNazwa].filter(Boolean).join(" · ") || "Zapytanie";
  const pending = row.status === "nowe";
  return (
    <article className={pending ? "box bk" : "box bk muted"}>
      {row.zdjecie ? (
        <img src={row.zdjecie} alt="" />
      ) : (
        <div className="ph" aria-hidden="true" />
      )}
      <div>
        <span className={pending ? "tag-wait" : "status-pill"}>{inquiryStatusLabel(row.status)}</span>
        <h3>{title}</h3>
        <p>{formatInquiryWhen(row.data, row.godzina)}</p>
        <p>
          {guestCountLabel(row.goscie)}
          {row.salaNazwa ? ` · ${row.salaNazwa}` : ""}
          {" · "}zapytanie wysłane {sent}
        </p>
        <p>
          {pending
            ? "Czeka w panelu lokalu. Nie wysłaliśmy SMS-a ani e-maila. To nie jest rezerwacja."
            : "To zakończone zapytanie, nie rezerwacja. Nie ma zadatku ani wpisu do kalendarza."}
        </p>
      </div>
      <div className="r">
        {row.kwota != null ? <b>{formatZloty(row.kwota)}</b> : <b className="help">Bez kwoty</b>}
        <p>{estimateNote(row.kwota)}</p>
        <Link className="btn ghost sm" href={`/konto/${row.id}`}>Szczegóły</Link>
      </div>
    </article>
  );
}
