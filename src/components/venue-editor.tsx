"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  GUEST_UNITS,
  PRICE_UNITS,
  VENUE_TYPES,
  groszeToInput,
  statusLabel,
  submitBlockers,
} from "../domain/rules";
import { internalVenueTitle } from "../domain/venues";
import type { Amenity, Occasion } from "../data/supabase/catalog";
import type { OwnerVenue } from "../data/supabase/owner";
import { PhotoUploader } from "./photo-uploader";
import {
  addMember,
  deletePhoto,
  deleteRoom,
  removeMember,
  saveRoom,
  pauseBookings,
  resumeBookings,
  saveVenue,
  submitVenue,
  updatePhoto,
  withdrawVenue,
} from "../app/panel/actions";

export function VenueEditor({
  venue,
  occasions,
  amenities,
  canManageAvailability,
}: {
  venue: OwnerVenue;
  occasions: Occasion[];
  amenities: Amenity[];
  canManageAvailability: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
  const blockers = submitBlockers({
    nazwa: venue.nazwa,
    miasto: venue.miasto,
    rooms: venue.sale.map((room) => ({
      nazwa: room.nazwa,
      widoczna: room.widoczna,
      pojemnosc: room.pojemnosc,
      cenaUstalona: room.cenaUstalona,
    })),
  });
  const canWithdraw =
    venue.status === "pending_review" ||
    (venue.status === "published" && venue.statusZgloszenia === "pending_review");

  return (
    <div className="stack">
      <div className="subhead">
        <div>
          <p className="status-pill">{statusLabel(venue.status, venue.statusZgloszenia, venue.dirty)}</p>
          <h1 className="disp">{internalVenueTitle(venue.nazwa)}</h1>
          {venue.rezerwacjeWstrzymane ? <p className="notice">Rezerwacje wstrzymane przez właściciela. To nie jest zawieszenie administratora ani wycofanie lokalu.</p> : null}
          {venue.przyklad ? <p className="help">To lokal przykładowy do ćwiczeń lokalnych.</p> : null}
          {venue.powod ? <p className="notice bad">Powód odrzucenia: {venue.powod}</p> : null}
          {venue.status === "published" ? (
            <p className="help">Goście widzą ostatnią zaakceptowaną wersję. „Zapisz wersję roboczą” jej nie podmienia.</p>
          ) : (
            <p className="help">Szkic nie jest w wyszukiwarce, na mapie ani na stronie lokalu. Zapis nie publikuje.</p>
          )}
          {dirty ? <p className="notice" role="status">Masz niezapisane zmiany w tej wersji roboczej.</p> : null}
        </div>
        <div className="row-actions">
          <form action={submitVenue}>
            <input type="hidden" name="id" value={venue.id} />
            <button className="btn" type="submit">Wyślij do weryfikacji</button>
          </form>
          <Link className="btn ghost" href={`/panel/${venue.id}/zapytania`}>Zapytania tego lokalu</Link>
          <Link className="btn ghost" href={`/panel/${venue.id}/kalendarz`}>Kalendarz dostępności</Link>
          {canWithdraw ? (
            <form action={withdrawVenue}>
              <input type="hidden" name="id" value={venue.id} />
              <button className="btn ghost" type="submit">Cofnij zgłoszenie</button>
            </form>
          ) : null}
        </div>
      </div>
      {blockers.length ? (
        <div className="notice">
          <strong>Zanim wyślesz, uzupełnij:</strong>
          <ul>{blockers.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="help">Nie wymagamy liczby zdjęć ani procentu uzupełnienia. To tymczasowa lista, łatwa do zmiany.</p>
        </div>
      ) : <p className="notice ok">Możesz wysłać lokal do sprawdzenia.</p>}

      <form
        className="form-card stack"
        action={saveVenue}
        onInput={() => setDirty(true)}
        onSubmit={() => setDirty(false)}
      >
        <h2>Profil lokalu</h2>
        <input type="hidden" name="id" value={venue.id} />
        <div className="fields">
          <label>Nazwa<input name="nazwa" defaultValue={venue.nazwa} /></label>
          <label>Typ
            <select name="typ" defaultValue={venue.typ}>
              {VENUE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="wide">Opis<textarea name="opis" defaultValue={venue.opis} /></label>
          <label className="wide">
            <span>Jeden obiekt, bez podziału na sale</span>
            <input type="checkbox" name="jeden_obiekt" defaultChecked={venue.jedenObiekt} />
          </label>
          <label>Adres<input name="adres" defaultValue={venue.adres} /></label>
          <label>Kod<input name="kod" defaultValue={venue.kod} /></label>
          <label>Miasto<input name="miasto" defaultValue={venue.miasto} /></label>
          <label>Dzielnica<input name="dzielnica" defaultValue={venue.dzielnica} /></label>
          <label>Szerokość geogr.<input name="lat" inputMode="decimal" defaultValue={venue.lat ?? ""} /></label>
          <label>Długość geogr.<input name="lng" inputMode="decimal" defaultValue={venue.lng ?? ""} /></label>
          <p className="help wide">Obie liczby albo obie puste. Adres sam nie stawia pinezki — nie ma geokodera. Na mapie widać je dopiero po publikacji.</p>
          <label>Telefon na stronie<input name="telefon_publiczny" defaultValue={venue.telefonPubliczny} /></label>
          <label>Końcówka adresu<input name="slug" defaultValue={venue.slug} /></label>
          <label>Godziny od<input name="godziny_od" type="time" defaultValue={venue.godzinyOd} /></label>
          <label>Godziny do<input name="godziny_do" type="time" defaultValue={venue.godzinyDo} /></label>
          <label className="wide">Zasady, jedna w wierszu<textarea name="zasady" defaultValue={venue.zasady} /></label>
        </div>
        <h2>Okazje</h2>
        <div className="check-grid">
          {occasions.map((item) => (
            <label key={item.kod}>
              <input type="checkbox" name="okazja" value={item.kod} defaultChecked={venue.okazje.includes(item.kod)} />
              {item.nazwa}
            </label>
          ))}
        </div>
        <h2>Udogodnienia</h2>
        <div className="stack">
          {amenities.map((item) => {
            const current = venue.udogodnienia.find((entry) => entry.kod === item.kod);
            return (
              <label key={item.kod}>
                <span><input type="checkbox" name="udogodnienie" value={item.kod} defaultChecked={Boolean(current)} /> {item.nazwa}</span>
                <input name={`szczegol_${item.kod}`} defaultValue={current?.szczegol ?? ""} placeholder="Szczegół, np. 30 miejsc" />
              </label>
            );
          })}
        </div>
        <h2>Dane niewidoczne na stronie</h2>
        <p className="help">E-mail i telefon wewnętrzny oraz notatka zostają u Ciebie i u administratora. Nie ma tu konta do wypłat — rozliczenia są poza tym etapem.</p>
        <div className="fields">
          <label>E-mail kontaktowy<input name="email_kontaktowy" type="email" defaultValue={venue.emailKontaktowy} /></label>
          <label>Telefon wewnętrzny<input name="telefon_wewnetrzny" defaultValue={venue.telefonWewnetrzny} /></label>
          <label className="wide">Notatka<textarea name="notatka" defaultValue={venue.notatka} /></label>
        </div>
        <button className="btn" type="submit">Zapisz wersję roboczą</button>
        <p className="help wide">Możesz zapisać niepełny opis. Wysyłka do weryfikacji nadal wymaga nazwy, miasta, sali i ceny. Zapis nie tworzy zapytania i nie publikuje.</p>
        {canManageAvailability ? (
          <div className="wide form-card stack">
            <h2>{venue.rezerwacjeWstrzymane ? "Wznów rezerwacje" : "Wstrzymaj lokal"}</h2>
            <p className="help">Strona lokalu zostaje widoczna. Nowe zapytanie nie przejdzie. Godziny zostają. To nie wycofuje lokalu i nie zdejmuje decyzji administratora.</p>
            <form action={venue.rezerwacjeWstrzymane ? resumeBookings : pauseBookings}>
              <input type="hidden" name="id" value={venue.id} />
              <label>
                <input type="checkbox" name="potwierdz" value="tak" />
                {venue.rezerwacjeWstrzymane
                  ? " Potwierdzam wznowienie przyjmowania zapytań."
                  : " Potwierdzam wstrzymanie nowych zapytań."}
              </label>
              <button className="btn ghost" type="submit">{venue.rezerwacjeWstrzymane ? "Wznów rezerwacje" : "Wstrzymaj lokal"}</button>
            </form>
            <p><Link href={`/panel/${venue.id}/wycofaj`}>Wycofaj lokal z serwisu</Link></p>
          </div>
        ) : null}
      </form>

      <section className="form-card">
        <h2>{venue.jedenObiekt ? "Cały lokal jako jedna sala" : "Sale"}</h2>
        <p className="help">Nawet lokal bez podziału ma jedną salę: tu jest pojemność i cena. Cena w złotych, w bazie trzymamy grosze.</p>
        {venue.sale.map((room) => (
          <form key={room.id} className="room fields" action={saveRoom}>
            <input type="hidden" name="lokal" value={venue.id} />
            <input type="hidden" name="sala" value={room.id} />
            <input type="hidden" name="kolejnosc" value={room.kolejnosc} />
            <label>Nazwa<input name="nazwa" defaultValue={room.nazwa} /></label>
            <label>Krótki opis<input name="opis" defaultValue={room.opis} /></label>
            <label>Goście<input name="pojemnosc" inputMode="numeric" defaultValue={room.pojemnosc ?? ""} /></label>
            <label>Jednostka
              <select name="jednostka" defaultValue={room.jednostka}>
                {GUEST_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Metraż<input name="metraz" inputMode="numeric" defaultValue={room.metraz ?? ""} /></label>
            <label>Widoczna<input type="checkbox" name="widoczna" defaultChecked={room.widoczna} /></label>
            <label>Cena, zł<input name="kwota" inputMode="decimal" defaultValue={groszeToInput(room.kwotaGrosze)} /></label>
            <label>Waluta<input name="waluta" defaultValue={room.waluta} maxLength={3} /></label>
            <label>Jednostka ceny
              <select name="jednostka_ceny" defaultValue={room.jednostkaCeny}>
                {PRICE_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Cena na zapytanie<input type="checkbox" name="cena_na_zapytanie" defaultChecked={room.cenaNaZapytanie} /></label>
            <div className="row-actions wide">
              <button className="btn sm" type="submit">Zapisz salę</button>
            </div>
          </form>
        ))}
        {venue.sale.map((room) => (
          <form key={`${room.id}-del`} action={deleteRoom}>
            <input type="hidden" name="lokal" value={venue.id} />
            <input type="hidden" name="sala" value={room.id} />
            <button className="btn ghost sm" type="submit">Usuń: {room.nazwa || "sala"}</button>
          </form>
        ))}
        <form className="room fields" action={saveRoom}>
          <input type="hidden" name="lokal" value={venue.id} />
          <input type="hidden" name="kolejnosc" value={venue.sale.length} />
          <h3 className="wide">Dodaj salę</h3>
          <label>Nazwa<input name="nazwa" placeholder="np. Sala kominkowa" /></label>
          <label>Krótki opis<input name="opis" /></label>
          <label>Goście<input name="pojemnosc" inputMode="numeric" /></label>
          <label>Jednostka
            <select name="jednostka" defaultValue="osoby">
              {GUEST_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Metraż<input name="metraz" inputMode="numeric" /></label>
          <label>Widoczna<input type="checkbox" name="widoczna" defaultChecked /></label>
          <label>Cena, zł<input name="kwota" inputMode="decimal" /></label>
          <label>Waluta<input name="waluta" defaultValue="PLN" maxLength={3} /></label>
          <label>Jednostka ceny
            <select name="jednostka_ceny" defaultValue="za_sale">
              {PRICE_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Cena na zapytanie<input type="checkbox" name="cena_na_zapytanie" /></label>
          <div className="wide"><button className="btn sm" type="submit">Dodaj salę</button></div>
        </form>
      </section>

      <section className="form-card stack">
        <h2>Zdjęcia</h2>
        <PhotoUploader venueId={venue.id} />
        {venue.zdjecia.map((photo) => (
          <div className="photo-admin" key={photo.id}>
            <img src={`/media/${photo.sciezka}`} alt={photo.podpis ?? ""} />
            <form className="stack" action={updatePhoto}>
              <input type="hidden" name="lokal" value={venue.id} />
              <input type="hidden" name="id" value={photo.id} />
              <label>Podpis<input name="podpis" defaultValue={photo.podpis ?? ""} /></label>
              <label>Autor i licencja<input name="licencja" defaultValue={photo.licencja ?? ""} /></label>
              <label>Kolejność<input name="kolejnosc" type="number" defaultValue={photo.kolejnosc} /></label>
              <label>Zdjęcie główne<input type="checkbox" name="glowne" defaultChecked={photo.glowne} /></label>
              <button className="btn sm" type="submit">Zapisz zdjęcie</button>
            </form>
            <form action={deletePhoto}>
              <input type="hidden" name="lokal" value={venue.id} />
              <input type="hidden" name="id" value={photo.id} />
              <input type="hidden" name="sciezka" value={photo.sciezka} />
              <button className="btn ghost sm" type="submit">Usuń zdjęcie</button>
            </form>
          </div>
        ))}
      </section>

      <section className="form-card stack">
        <h2>Osoby przy lokalu</h2>
        <p className="help">Rola właściciela lub managera dotyczy tylko tego lokalu. Nie da się tu nadać roli administratora portalu.</p>
        <ul>
          {venue.czlonkowie.map((member) => (
            <li key={member.profil_id}>
              {member.imie_nazwisko || member.email} · {member.rola === "wlasciciel" ? "właściciel" : "manager"}
              <form action={removeMember}>
                <input type="hidden" name="id" value={venue.id} />
                <input type="hidden" name="profil" value={member.profil_id} />
                <button className="btn ghost sm" type="submit">Usuń</button>
              </form>
            </li>
          ))}
        </ul>
        <form className="fields" action={addMember}>
          <input type="hidden" name="id" value={venue.id} />
          <label>E-mail osoby z kontem<input name="email" type="email" required /></label>
          <label>Rola w lokalu
            <select name="rola" defaultValue="manager">
              <option value="manager">Manager</option>
              <option value="wlasciciel">Właściciel</option>
            </select>
          </label>
          <div className="wide"><button className="btn sm" type="submit">Dodaj osobę</button></div>
        </form>
      </section>
    </div>
  );
}
