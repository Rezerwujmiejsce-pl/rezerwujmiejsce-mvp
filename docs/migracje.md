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

## Jeszcze nie wgrane

Po `20261110092253`, każdy raz, bez `db reset` i bez przykładowych wierszy:

| plik | po co |
| --- | --- |
| `supabase/migrations/20261110092606_wycofaj_wlasny_lokal.sql` | właściciel zdejmuje własny lokal z serwisu, zostawia wiersz i zapytania |
| `supabase/migrations/20261110092741_wstrzymaj_rezerwacje.sql` | właściciel wstrzymuje nowe zapytania, strona zostaje |
| `supabase/migrations/20261110093540_kalendarz_dostepnosci.sql` | blokady wybranego lokalu i sal, publiczny pasek bez danych gościa |

Kolejność po `20261110092253`: najpierw `20261110092606`, potem `20261110092741`, potem `20261110093540`. Każdy plik raz. Nie robić `db reset` i nie dopisywać przykładowych lokali. Kalendarz nie był wgrywany na DEV z tego środowiska. Test lokalny szedł na `rezerwuj_test` i kończył się `rollback`.

Pasek publiczny zwraca tylko `dzien` i `stan` (`wolne`, `zajete`, `wstrzymane`). Zapytanie `nowe` zajmuje wskazaną salę do końca godzin lokalu albo na dwie godziny, gdy zamknięcia nie ma. Nie znika samo po 24 godzinach. `odrzucone`, `wygasle` i `inny_termin` nie blokują. `zaakceptowane` znaczy ręcznie przyjęty termin, nie opłaconą rezerwację; ta migracja takiego statusu nie ustawia. Sala pusta w blokadzie oznacza cały lokal. Zajęta jedna sala nie oznacza całego dnia jako zajętego, dopóki inna opublikowana sala jest wolna. Właściciel nie zdejmie zapytania oznaczeniem „wolne”.

Szczegóły: [zapytania.md](zapytania.md), [strona.md](strona.md). Brak wiersza w `strona_publikacja` jest stanem poprawnym.

## Czego nie wgrywać na DEV

Nie uruchamiaj `supabase/przyklad/seed.sql`. To lokale ćwiczeniowe.

Nie wgrywaj klucza `service_role` do Vercel jako zmiennej `NEXT_PUBLIC_*`.

Administratora nadaj według [administrator.md](administrator.md), już na tym projekcie, gdy ma powstać pierwsze konto. Sama migracja kont nie zakłada.

Słowniki okazji i udogodnień są w migracji inicjalnej. To katalog startowy, nie lokale.

Schemat `private` nie jest na liście schematów API (`supabase/config.toml` wystawia tylko `public`).
