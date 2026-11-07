import { Shell } from "../../components/shell";

export default function PrivacyPage() {
  return (
    <Shell sharePath="/polityka-prywatnosci">
      <main className="wrap page-pad">
        <article className="form-card stack">
          <h1 className="disp">Polityka prywatności</h1>
          <p><em>Szkic do zatwierdzenia. Nie stanowi porady prawnej.</em></p>
          <h2>Administrator</h2>
          <p>Administratorem danych konta w tym serwisie jest Wojciech Kościesza. Kontakt: <a href="mailto:wojciech.kosciesza@gmail.com">wojciech.kosciesza@gmail.com</a>.</p>
          <h2>Co zbiera ten etap</h2>
          <ul>
            <li>adres e-mail i hasło konta (hasło trzyma Supabase Auth, nie w tabeli profilu),</li>
            <li>imię i telefon, jeśli je podasz,</li>
            <li>opis lokalu, zdjęcia oraz kontakt wewnętrzny lokalu.</li>
          </ul>
          <p>Szkic lokalu i dane wewnętrzne nie są widoczne dla osób niezalogowanych. Opublikowany opis widzą goście.</p>
          <h2>Czego tu nie ma</h2>
          <p>Nie zbieramy płatności, zadatków ani wiadomości SMS. Rezerwacji jeszcze nie przyjmujemy.</p>
        </article>
      </main>
    </Shell>
  );
}
