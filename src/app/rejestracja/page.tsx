import Link from "next/link";
import { becomeOwner, signUp } from "../konto/actions";
import { Flash } from "../../components/chrome";
import { Shell } from "../../components/shell";
import { loadSession } from "../../data/supabase/session";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await loadSession();
  return (
    <Shell sharePath="/rejestracja">
      <main className="wrap page-pad">
        <div className="auth stack">
          <form className="stack form-card" action={signUp}>
            <h1 className="disp">Dodaj swój lokal</h1>
            <p className="help">Konto dostaje rolę właściciela. Nie staje się administratorem. Administratora zakłada osobno operator bazy.</p>
            <Flash info={params.info} blad={params.blad} />
            <label>Imię i nazwisko<input name="imie" autoComplete="name" /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
            <label>Telefon<input name="telefon" type="tel" autoComplete="tel" /></label>
            <label>Hasło<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
            <button className="btn" type="submit">Załóż konto właściciela</button>
            <p>Masz już konto? <Link href="/logowanie">Zaloguj się</Link></p>
          </form>
          {session.profile && session.profile.rola === "klient" ? (
            <form className="form-card stack" action={becomeOwner}>
              <h2>To konto ma prowadzić lokal</h2>
              <p className="help">Jesteś zalogowany jako {session.profile.email}. Ten przycisk zmienia rolę z gościa na właściciela. Nie nadaje uprawnień administratora.</p>
              <button className="btn" type="submit">Prowadzę lokal</button>
            </form>
          ) : null}
        </div>
      </main>
    </Shell>
  );
}
