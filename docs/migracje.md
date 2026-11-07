# Migracje na projekt DEV

Projekt: `rezerwujmiejsce-mvp-dev`, ref `uksiphxyrpanubfjixhg`, region Frankfurt.

## Już wgrane — nie powtarzać

Connector zapisał pierwszą migrację jako:

| version | name |
| --- | --- |
| `20261107122010` | `init_schema_rls_storage` |

Plik w repozytorium ma tę samą wersję w nazwie:

`supabase/migrations/20261107122010_init_schema_rls_storage.sql`

Wcześniejszy prefiks `20261107113350` był tylko lokalną nazwą pliku, zanim connector nadał wersję `20261107122010`. Na DEV tej starszej wersji nie ma. Nie wgrywaj pliku inicjalnego drugi raz: tabele już są, a powtórka się wywali.

Dopasowanie historii jest zwykłą zmianą nazwy pliku w gicie. Stary commit nie był przepisywany. `supabase db push` porównuje numer wersji, więc plik `20261107122010` uzna za już zastosowany i go pominie.

Świeża baza lokalna (`supabase db reset` albo pierwsze `supabase start`) puszcza pliki po kolei. Najpierw `20261107122010`, potem migrację z poprawką `search_path`.

Jeśli jakaś **lokalna** baza ma w `supabase_migrations.schema_migrations` wersję `20261107113350` (bo ktoś odpalił starą nazwę pliku u siebie), nie ruszaj tym DEV. Lokalnie wystarczy `supabase db reset`. Nie uruchamiaj `migration repair` na projekcie zdalnym.

## Następna do wgrania przez connector

Tylko ten plik:

`supabase/migrations/20261107122202_fix_private_function_search_path.sql`

Ustawia pusty `search_path` na pięciu funkcjach pomocniczych (`zloz_tekst`, `zloz_miasto`, `slugify`, `uuid_albo_null`, `dotknij`). Nie zmienia ich treści, sygnatur ani danych. Nie tworzy użytkowników.

## Czego nie wgrywać na DEV

Nie uruchamiaj `supabase/przyklad/seed.sql`. To lokale ćwiczeniowe.

Nie wgrywaj klucza `service_role` do Vercel jako zmiennej `NEXT_PUBLIC_*`.

Administratora nadaj według [administrator.md](administrator.md), już na tym projekcie, gdy ma powstać pierwsze konto. Sama migracja kont nie zakłada.

Słowniki okazji i udogodnień są w migracji inicjalnej. To katalog startowy, nie lokale.

Schemat `private` nie jest na liście schematów API (`supabase/config.toml` wystawia tylko `public`).
