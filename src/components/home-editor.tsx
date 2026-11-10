"use client";

import { useMemo, useState } from "react";
import { HOME_BANNERS, HOME_DEFAULTS, homeProblems } from "../domain/home";
import type { Occasion } from "../data/supabase/catalog";
import { saveHome, publishHome } from "../app/admin/strona/actions";

export function HomeEditor({
  naglowek,
  podtytul,
  baner,
  occasions,
  settings,
}: {
  naglowek: string;
  podtytul: string;
  baner: string;
  occasions: Occasion[];
  settings: { kod: string; kolejnosc: number; widoczna: boolean }[];
}) {
  const initial = useMemo(() => {
    const byCode = new Map(settings.map((item) => [item.kod, item]));
    return occasions.map((item, index) => ({
      kod: item.kod,
      nazwa: item.nazwa_kafla,
      kolejnosc: byCode.get(item.kod)?.kolejnosc ?? item.kolejnosc ?? index,
      widoczna: byCode.get(item.kod)?.widoczna ?? true,
    }));
  }, [occasions, settings]);
  const [title, setTitle] = useState(naglowek);
  const [lead, setLead] = useState(podtytul);
  const [image, setImage] = useState(HOME_BANNERS.includes(baner as (typeof HOME_BANNERS)[number]) ? baner : HOME_DEFAULTS.baner);
  const [tiles, setTiles] = useState(initial);
  const problems = homeProblems({ naglowek: title, podtytul: lead, baner: image });
  const payload = JSON.stringify(tiles.map((tile) => ({ kod: tile.kod, kolejnosc: Number(tile.kolejnosc), widoczna: tile.widoczna })));

  return (
    <div className="stack">
      <section className="box" aria-label="Podgląd strony głównej">
        <p className="help">Podgląd jeszcze nie zmienia publicznej strony.</p>
        <img src={image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />
        <h2 className="disp">{title || "Brak nagłówka"}</h2>
        <p>{lead || "Brak podtytułu"}</p>
        <p className="help">
          Kafle: {tiles.filter((tile) => tile.widoczna).map((tile) => tile.nazwa).join(", ") || "żaden"}
        </p>
      </section>
      {problems.length ? <p className="notice bad">{problems[0]}</p> : null}
      <form className="form-card fields" action={saveHome}>
        <input type="hidden" name="okazje" value={payload} />
        <label className="wide">Nagłówek
          <input name="naglowek" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
        </label>
        <label className="wide">Podtytuł
          <textarea name="podtytul" value={lead} onChange={(event) => setLead(event.target.value)} maxLength={400} required />
        </label>
        <label className="wide">Baner
          <select name="baner" value={image} onChange={(event) => setImage(event.target.value)}>
            {HOME_BANNERS.map((path) => <option key={path} value={path}>{path}</option>)}
          </select>
        </label>
        <div className="wide">
          <h2>Kafle okazji</h2>
          <p className="help">Kolejność i widoczność dotyczą tylko strony głównej. Wyszukiwarka nadal ma pełną listę okazji. Nowy kafel z katalogu zostaje widoczny, dopóki go nie ukryjesz.</p>
          {tiles.map((tile, index) => (
            <div className="row-actions" key={tile.kod}>
              <label>
                <input
                  type="checkbox"
                  checked={tile.widoczna}
                  onChange={(event) => setTiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, widoczna: event.target.checked } : item))}
                /> {tile.nazwa}
              </label>
              <label>Kolejność
                <input
                  inputMode="numeric"
                  value={tile.kolejnosc}
                  onChange={(event) => setTiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kolejnosc: Number(event.target.value) } : item))}
                />
              </label>
            </div>
          ))}
        </div>
        <div className="wide row-actions">
          <button className="btn ghost" type="submit">Zapisz szkic</button>
        </div>
      </form>
      <form action={publishHome}>
        <input type="hidden" name="naglowek" value={title} />
        <input type="hidden" name="podtytul" value={lead} />
        <input type="hidden" name="baner" value={image} />
        <input type="hidden" name="okazje" value={payload} />
        <button className="btn" type="submit">Opublikuj na stronie głównej</button>
        <p className="help">Publikacja zapisuje ten podgląd i dopiero wtedy podmienia tekst widoczny dla gości.</p>
      </form>
    </div>
  );
}
