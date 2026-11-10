import Link from "next/link";
import type { ProfileRow } from "../data/supabase/session";
import { signOut } from "../app/konto/actions";
import { shortAccountLabel } from "../domain/inquiry";
import { LogoLockup } from "./logo";
import { MenuButton } from "./menu-button";
import { ShareMenu } from "./share-menu";

export function Header({
  profile,
  solid,
  sharePath,
}: {
  profile: ProfileRow | null;
  solid?: boolean;
  sharePath: string;
}) {
  return (
    <nav className={solid ? "nav solid" : "nav"} aria-label="Główna">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="rezerwujmiejsce.pl – strona główna">
          <LogoLockup tone={solid ? "light" : "dark"} />
        </Link>
        <div className="nav-right">
          <ShareMenu path={sharePath} light={!solid} />
          <MenuButton />
          <ul id="nav-links">
            <li><Link href="/sale">Przeglądaj sale</Link></li>
            <li><Link href="/rejestracja">Dodaj swój lokal</Link></li>
            {profile ? (
              <>
                <li><Link href="/konto">{shortAccountLabel(profile.imie_nazwisko, profile.email)}</Link></li>
                {profile.rola !== "klient" ? <li><Link href="/panel">Twój lokal</Link></li> : null}
                {profile.rola === "admin" ? <li><Link href="/admin">Weryfikacja</Link></li> : null}
                <li>
                  <form action={signOut}>
                    <button type="submit" className="linkish">Wyloguj</button>
                  </form>
                </li>
              </>
            ) : (
              <li><Link href="/logowanie">Zaloguj się</Link></li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <Link className="logo" href="/" aria-label="rezerwujmiejsce.pl – strona główna">
          <LogoLockup tone="light" compact />
        </Link>
        <p>
          Lokale na stronie pochodzą z bazy po weryfikacji. Zdjęcia kafli i baneru są materiałem układu z prototypu (Wikimedia Commons, CC BY-SA), nie ofertą lokalu.{" "}
          <Link href="/polityka-prywatnosci">Polityka prywatności</Link>
        </p>
      </div>
    </footer>
  );
}

export function Flash({ info, blad }: { info?: string; blad?: string }) {
  if (!info && !blad) return null;
  return (
    <p className={blad ? "notice bad" : "notice ok"} role="status">
      {blad || info}
    </p>
  );
}
