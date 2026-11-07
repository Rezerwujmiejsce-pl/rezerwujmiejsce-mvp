import Link from "next/link";
import type { ProfileRow } from "../data/supabase/session";
import { signOut } from "../app/konto/actions";
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
          <img src={solid ? "/img/logo-dark.svg" : "/img/logo-light.svg"} alt="rezerwujmiejsce.pl" width={200} height={27} />
        </Link>
        <div className="nav-right">
          <ShareMenu path={sharePath} light={!solid} />
          <MenuButton />
          <ul id="nav-links">
            <li><Link href="/sale">Przeglądaj sale</Link></li>
            <li><Link href="/rejestracja">Dodaj swój lokal</Link></li>
            {profile ? (
              <>
                <li><Link href="/panel">Twój lokal</Link></li>
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
        <img src="/img/logo-dark.svg" alt="rezerwujmiejsce.pl" width={150} height={20} />
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
