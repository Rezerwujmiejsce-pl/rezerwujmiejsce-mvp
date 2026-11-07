# Migracje na projekt DEV

Projekt: `rezerwujmiejsce-mvp-dev`, ref `uksiphxyrpanubfjixhg`, region Frankfurt. W momencie tej zmiany był pusty i **nie był ruszany z tego środowiska** — nie było uprawnionego dostępu.

Plik do wgrania, w tej kolejności, jako pierwsza migracja:

`supabase/migrations/20261107113350_init_schema_rls_storage.sql`

## Jak wgrać (coordinator)

Jedna z dróg, na maszynie osoby, która ma dostęp do projektu:

1. **SQL Editor** w panelu Supabase: wkleić treść pliku i uruchomić. Potem sprawdzić, że w Database → Migrations historia się zgadza, albo zapisać tę samą wersję przez CLI, żeby kolejne `db push` nie próbowało wgrać jej drugi raz.
2. **CLI**, po `supabase login` i świadomym powiązaniu:
   ```bash
   supabase link --project-ref uksiphxyrpanubfjixhg
   supabase db push
   ```
   `link` pyta o hasło bazy. Nie wklejaj go do repozytorium.

Nie uruchamiaj `supabase/przyklad/seed.sql` na projekcie DEV. To lokale ćwiczeniowe.

Nie wgrywaj klucza `service_role` do Vercel jako zmiennej `NEXT_PUBLIC_*`.

Po migracji nadaj administratora według [administrator.md](administrator.md), już na tym projekcie.

Słowniki okazji i udogodnień są w tej samej migracji. To katalog startowy, nie lokale.

Schemat `private` nie jest na liście schematów API (`supabase/config.toml` wystawia tylko `public`). Funkcje, które publikują lokal, sprawdzają rolę w tabeli `profile`, a nie pole, które użytkownik może sobie wpisać przy rejestracji.
