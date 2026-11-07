import {
  GUEST_UNITS,
  PRICE_UNITS,
  VENUE_TYPES,
  groszeToInput,
  statusLabel,
  submitBlockers,
} from "../domain/rules";
import type { Amenity, Occasion } from "../data/supabase/catalog";
import type { OwnerVenue } from "../data/supabase/owner";
import { PhotoUploader } from "./photo-uploader";
import {
  addMember,
  deletePhoto,
  deleteRoom,
  removeMember,
  saveRoom,
  saveVenue,
  submitVenue,
  updatePhoto,
  withdrawVenue,
} from "../app/panel/actions";

export function VenueEditor({
  venue,
  occasions,
  amenities,
}: {
  venue: OwnerVenue;
  occasions: Occasion[];
  amenities: Amenity[];
}) {
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
          <h1 className="disp">{venue.nazwa || "Nowy lokal"}</h1>
          {venue.przyklad ? <p className="help">To lokal przykładowy do ćwiczeń lokalnych.</p> : null}
          {venue.powod ? <p className="notice bad">Powód odrzucenia: {venue.powod}</p> : null}
          {venue.status === "published" ? (
            <p className="help">Goście widzą ostatnią zaakceptowaną wersję. Zapis tutaj jej nie podmienia.</p>
          ) : (
            <p className="help">Szkic i odrzucenie nie są widoczne w wyszukiwarce.</p>
          )}
        </div>
        <div className="row-actions">
          <form action={submitVenue}>
            <input type="hidden" name="id" value={venue.id} />
            <button className="btn" type="submit">Wyślij do weryfikacji</button>
          </form>
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

      <form className="form-card stack" action={saveVenue}>
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
          <label>Szerokość geogr.<input name="lat" defaultValue={venue.lat ?? ""} /></label>
          <label>Długość geogr.<input name="lng" defaultValue={venue.lng ?? ""} /></label>
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
        <button className="btn" type="submit">Zapisz profil</button>
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
