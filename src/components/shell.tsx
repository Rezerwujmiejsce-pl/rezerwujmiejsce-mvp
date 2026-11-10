import { Header } from "./chrome";
import { loadSession } from "../data/supabase/session";

export async function Shell({
  sharePath,
  children,
}: {
  sharePath: string;
  children: React.ReactNode;
}) {
  const session = await loadSession();
  return (
    <>
      <Header profile={session.profile} solid sharePath={sharePath} />
      {session.env.ok === false ? null : session.unreachable ? (
        <p className="notice bad wrap">Nie udało się połączyć z bazą. Nie pokazujemy wtedy lokali z pamięci ani danych wymyślonych.</p>
      ) : null}
      {children}
    </>
  );
}
