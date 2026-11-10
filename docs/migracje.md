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

## Nowa, jeszcze nie wgrana

Na DEV jest już trzecia migracja. Nie wgrywać jej drugi raz i nie dopisywać starego numeru `20261110084306` przez `migration repair`.

| version na DEV | name | plik |
| --- | --- | --- |
| `20261110091341` | `zapytania_o_termin` | `supabase/migrations/20261110091341_zapytania_o_termin.sql` |

Jeszcze nie wgrane. Po kolei, każdy raz, bez `db reset` i bez przykładowych wierszy:

| plik | po czym |
| --- | --- |
| `supabase/migrations/20261110091751_potwierdzenie_zapytania.sql` | `20261110091341` |
| `supabase/migrations/20261110091752_strona_glowna.sql` | `20261110091341`; nie zależy od potwierdzenia |
| `supabase/migrations/20261110091756_zapytania_limit_i_odczyt.sql` | `20261110091341`; podmienia tylko ciało `private.wyslij_zapytanie` i politykę odczytu |

Szczegóły: [zapytania.md](zapytania.md), [strona.md](strona.md). Brak wiersza w `strona_publikacja` jest stanem poprawnym.

## Czego nie wgrywać na DEV

Nie uruchamiaj `supabase/przyklad/seed.sql`. To lokale ćwiczeniowe.

Nie wgrywaj klucza `service_role` do Vercel jako zmiennej `NEXT_PUBLIC_*`.

Administratora nadaj według [administrator.md](administrator.md), już na tym projekcie, gdy ma powstać pierwsze konto. Sama migracja kont nie zakłada.

Słowniki okazji i udogodnień są w migracji inicjalnej. To katalog startowy, nie lokale.

Schemat `private` nie jest na liście schematów API (`supabase/config.toml` wystawia tylko `public`).
