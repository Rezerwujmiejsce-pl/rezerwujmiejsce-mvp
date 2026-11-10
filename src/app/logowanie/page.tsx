import Link from "next/link";
import { signIn } from "../konto/actions";
import { Flash } from "../../components/chrome";
import { Shell } from "../../components/shell";
import { safeNextPath } from "../../domain/rules";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next) : "";
  return (
    <Shell sharePath="/logowanie">
      <main className="wrap page-pad">
        <form className="stack auth form-card" action={signIn}>
          <h1 className="disp">Zaloguj się</h1>
          <Flash info={params.info} blad={params.blad} />
          <input type="hidden" name="next" value={next} />
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Hasło<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn" type="submit">Zaloguj się</button>
          <p>Nie masz konta? <Link href="/rejestracja">Dodaj swój lokal</Link></p>
        </form>
      </main>
    </Shell>
  );
}
