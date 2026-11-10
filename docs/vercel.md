# Gotowość pod Vercel — bez wdrożenia

Tego wycinka nie wdrażamy na produkcję. Domena zostaje w OVH. Nie zmieniamy DNS, billingu ani strony `/test/`. Podgląd na Vercel, jeśli powstanie, ma wskazywać projekt DEV `uksiphxyrpanubfjixhg`, nie produkcję.

## Zmienne środowiska podglądu

Wpisz je w Vercel (Preview). W repozytorium są tylko nazwy, w `.env.example`.

| Zmienna | Potrzebna na podglądzie | Po co |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | tak | Adres API projektu DEV, czyli host `https://<ref>.supabase.co` tego projektu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tak, albo zamiast niej `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Klucz publiczny. Sam nie omija RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | nie | Strona go nie czyta. Nie dodawaj przedrostka `NEXT_PUBLIC_` |
| `SUPABASE_DB_URL` | nie | Tylko skrypt administratora na komputerze operatora, nie na Vercel |

Bez dwóch pierwszych strona pokazuje, że bazy nie ma. Nie zmyśla lokali.

Build lokalny (`npm run build`) nie potrzebuje prawdziwych wartości.

## Adresy przekierowań w Auth projektu DEV

Lokalny `supabase/config.toml` dotyczy tylko bazy na komputerze. Podgląd Vercel trzeba dopisać w panelu Supabase projektu DEV: Authentication → URL Configuration.

- **Site URL** — dokładny adres podglądu, na przykład `https://<nazwa-projektu>.vercel.app` albo stabilny alias preview. Link z maila potwierdzającego (jeśli potwierdzanie jest włączone) wraca właśnie tutaj.
- **Redirect URLs** — ten sam adres, dokładny, ze slashem na końcu jeśli panel tak wymaga. Ta aplikacja nie ma trasy `/auth/callback`. Logowanie hasłem nie dokleja własnego adresu powrotu. Dopisz też `http://127.0.0.1:3000` i `http://localhost:3000`, jeśli ktoś odpala stronę lokalnie na tym samym projekcie DEV.
- Nie ustawiaj Site URL na `https://rezerwujmiejsce.pl`, dopóki nie ma osobnej zgody na produkcję.

Potwierdzanie e-maila na DEV włącz, zanim wejdą prawdziwi ludzie. Lokalnie w `config.toml` jest wyłączone tylko dla wygody.

Strona ma `noindex`, dopóki to podgląd.

Nie podłączaj automatycznego wdrożenia na domenę `rezerwujmiejsce.pl`.
