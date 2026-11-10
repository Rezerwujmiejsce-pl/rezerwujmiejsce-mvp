# Migracje na projekt DEV

Projekt: `rezerwujmiejsce-mvp-dev`, ref `uksiphxyrpanubfjixhg`, region Frankfurt.

## Już wgrane — nie powtarzać

Connector zapisał obie migracje. Numery w repozytorium są takie same jak na DEV:

| version na DEV | name | plik |
| --- | --- | --- |
| `20261107122010` | `init_schema_rls_storage` | `supabase/migrations/20261107122010_init_schema_rls_storage.sql` |
| `20261110082734` | `fix_private_function_search_path` | `supabase/migrations/20261110082734_fix_private_function_search_path.sql` |

Pięć poleceń `ALTER FUNCTION ... SET search_path = ''` jest bez zmian. Zmieniona jest tylko nazwa pliku drugiej migracji: wcześniej w gicie było `20261107122202`, connector zapisał `20261110082734`. Historia zdalna nie była ruszana i plik nie był wgrywany drugi raz.

`supabase db push` porównuje numer wersji, więc oba pliki pominie. Świeża baza lokalna (`supabase start` albo `supabase db reset`) puszcza je po kolei: najpierw schemat, potem `search_path`.

Starych prefiksów `20261107113350` i `20261107122202` na DEV nie ma. Nie dopisuj ich przez `migration repair` na projekcie zdalnym. Jeśli lokalna baza ma któryś z tych starych numerów, zresetuj ją u siebie (`supabase db reset`).

Ostrzeżenie advisora `auth_leaked_password_protection` zostało bez zmian. To ustawienie Auth, nie ta migracja.

## Już na DEV, nie powtarzać

Nie dopisywać starych numerów `20261110084306`, `20261110091751`, `20261110091752` ani `20261110091756` przez `migration repair`.

| version na DEV | name | plik |
| --- | --- | --- |
| `20261110091341` | `zapytania_o_termin` | `supabase/migrations/20261110091341_zapytania_o_termin.sql` |
| `20261110092221` | `potwierdzenie_zapytania` | `supabase/migrations/20261110092221_potwierdzenie_zapytania.sql` |
| `20261110092234` | `strona_glowna` | `supabase/migrations/20261110092234_strona_glowna.sql` |
| `20261110092253` | `zapytania_limit_i_odczyt` | `supabase/migrations/20261110092253_zapytania_limit_i_odczyt.sql` |
| `20261110095119` | `wycofaj_wlasny_lokal` | `supabase/migrations/20261110095119_wycofaj_wlasny_lokal.sql` |
| `20261110095124` | `wstrzymaj_rezerwacje` | `supabase/migrations/20261110095124_wstrzymaj_rezerwacje.sql` |
| `20261110095947` | `kalendarz_dostepnosci` | `supabase/migrations/20261110095947_kalendarz_dostepnosci.sql` |
| `20261110095951` | `zawieszenie_lokalu` | `supabase/migrations/20261110095951_zawieszenie_lokalu.sql` |
| `20261110095956` | `zapytania_admin` | `supabase/migrations/20261110095956_zapytania_admin.sql` |

## Już na DEV, pod nowym numerem — nie powtarzać

`20261110092606` na DEV nazywa się `20261110095119`. `20261110092741` na DEV nazywa się `20261110095124`. `20261110095345` to `20261110095947`, `20261110095347` to `20261110095951`, `20261110095350` to `20261110095956`. SQL tych plików jest ten sam co przed zmianą nazwy. Nie wgrywać ich drugi raz i nie dopisywać starych numerów przez `migration repair`.

Pasek publiczny zwraca tylko `dzien` i `stan` (`wolne`, `zajete`, `wstrzymane`). Zapytanie `nowe` zajmuje wskazaną salę do końca godzin lokalu albo na dwie godziny, gdy zamknięcia nie ma, ale tylko dopóki `wygasa_o` jest w przyszłości. `wygasa_o` to 24 godziny od utworzenia. Po tej chwili status zostaje `nowe`, a sala wraca do puli. Nie robi tego cron. `odrzucone`, `wygasle`, `anulowane` i `inny_termin` nie blokują. `zaakceptowane` znaczy ręcznie przyjęty termin, nie opłaconą rezerwację. Sala pusta w blokadzie oznacza cały lokal. Zajęta jedna sala nie oznacza całego dnia jako zajętego, dopóki inna opublikowana sala jest wolna. Właściciel nie zdejmie zapytania oznaczeniem „wolne”.

Zawieszenie administratora nie jest wstrzymaniem właściciela i nie jest wycofaniem. Zdejmuje migawkę ze strony i chowa ją. Przywrócenie wkłada tę migawkę z powrotem. Szkic właściciela nie wchodzi na stronę. Właściciel nie zdejmuje tego zawieszenia zapisem szkicu ani wycofaniem.

Szczegóły: [zapytania.md](zapytania.md), [strona.md](strona.md). Brak wiersza w `strona_publikacja` jest stanem poprawnym.

## Czego nie wgrywać na DEV

Nie uruchamiaj `supabase/przyklad/seed.sql`. To lokale ćwiczeniowe.

Nie wgrywaj klucza `service_role` do Vercel jako zmiennej `NEXT_PUBLIC_*`.

Administratora nadaj według [administrator.md](administrator.md), już na tym projekcie, gdy ma powstać pierwsze konto. Sama migracja kont nie zakłada.

Słowniki okazji i udogodnień są w migracji inicjalnej. To katalog startowy, nie lokale.

Schemat `private` nie jest na liście schematów API (`supabase/config.toml` wystawia tylko `public`).
