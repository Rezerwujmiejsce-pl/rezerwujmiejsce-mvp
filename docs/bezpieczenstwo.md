# Bezpieczeństwo tego wycinka

Reguły są w bazie. Strona ich nie zastępuje.

## Role

Nowe konto dostaje rolę klienta. Właścicielem zostaje się osobnym wywołaniem, które podnosi tylko `klient` → `wlasciciel`. Administratorem nie zostaje się ze strony.

`bootstrap_admin` leży w schemacie `private`. Nie ma jej w `public`, więc PostgREST jej nie wystawia — ani dla klucza anon, ani dla zalogowanego, ani dla service role przez RPC. Wywołuje ją operator w edytorze SQL albo skrypt `npm run admin:bootstrap` połączony wprost z bazą. Szczegóły: [administrator.md](administrator.md).

## Funkcje uprzywilejowane

Supabase ostrzega, żeby nie trzymać `security definer` w schemacie wystawionym w API (`public`). Dlatego:

- ciało publikacji, odrzucenia, archiwizacji, członkostwa i bootstrapu jest w `private` i ma `security definer` oraz `search_path = ''`;
- w `public` są cienkie funkcje `security invoker` z tym samym `search_path`. One tylko wołają `private` i same nie podnoszą uprawnień;
- `public` nie zawiera żadnej funkcji `security definer` (pilnuje tego test);
- `bootstrap_admin` nie ma wersji w `public`.

Sprawdzenie roli jest w ciele `private`, nie w tym, że ktoś „nie zna nazwy funkcji”. Właściciel, który zawoła `public.zatwierdz_lokal`, dostaje odmowę.

Schemat `private` nie jest na liście `api.schemas` w `supabase/config.toml`.

## Zdjęcia po publikacji

Migawka zapisuje ścieżkę pliku. Ta ścieżka jest zamrożona:

- dopóki wiersz jest w `opublikowane_zdjecia`, nikt (właściciel ani administrator) nie zaktualizuje i nie skasuje obiektu w Storage;
- nowa wersja zdjęcia to nowy plik, z nową ścieżką;
- usunięcie zdjęcia ze szkicu nie rusza pliku, który nadal jest w migawce;
- kolejna akceptacja podmienia migawkę. Stara ścieżka z niej wypada i dopiero wtedy wolno skasować stary plik. Nowy plik znowu jest zamrożony.

Nie kopiujemy bajtów przy akceptacji. Kopiujemy ścieżkę, a polityki bronią bajtów. Test w `supabase/tests/rls_security.test.sql` przechodzi: nadpisanie, kasowanie, zostawienie starej migawki i publikację nowego pliku.

## Cache HTTP

Adres `/media/...` bywa szkicem dla właściciela i 404 dla gościa, a po ukryciu lokalu ten sam adres przestaje być publiczny. Odpowiedź ma `Cache-Control: private, no-store`, `Vary: Cookie` i `CDN-Cache-Control: no-store` zarówno dla szkicu, jak i dla opublikowanego pliku. Współdzielony cache nie dostaje kopii, która przeżyłaby wycofanie publikacji.

## search_path funkcji pomocniczych

`private.zloz_tekst`, `zloz_miasto`, `slugify`, `uuid_albo_null` i `dotknij` nie miały przypiętego `search_path`. Advisor słusznie to zgłasza: przy wywołaniu dałoby się podmienić ścieżkę wyszukiwania.

Poprawka jest w `supabase/migrations/20261110082734_fix_private_function_search_path.sql`. To pięć poleceń `alter function ... set search_path = ''`, bez zmiany treści. Wewnątrz są tylko funkcje z `pg_catalog` albo już kwalifikowane wywołanie `private.zloz_tekst`. Triggery i polityki, które ich używają, zostają te same.

Na DEV ta wersja jest już zapisana (connector nadał numer `20261110082734`). Nie wgrywać jej drugi raz. Szczegóły: [migracje.md](migracje.md). Ostrzeżenie `auth_leaked_password_protection` nie należy do tej migracji i zostaje bez zmian.

## Czego test nie zastępuje

Pełny `supabase start` (Auth, Storage API, PostgREST w jednej sieci Dockera) w środowisku, w którym kontenery nie widzą się po TCP, nie wstaje. Test ról idzie bezpośrednio na Postgresie i sprawdza te same polityki, których używa Storage.
