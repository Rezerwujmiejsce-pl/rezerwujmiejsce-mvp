# Testy

## Reguły bez bazy

```bash
npm test
```

Sprawdza grosze, tymczasowe warunki wysłania (bez progu zdjęć i bez procentu), etykiety statusu, rozpoznawanie JPEG/PNG/WebP oraz odrzucenie adresu powrotu, który wygląda jak obca strona.

## Reguły w bazie

Przy włączonym Dockerze i `supabase start`:

```bash
npm run test:security
```

To `supabase test db`. Plik: `supabase/tests/rls_security.test.sql`.

Scenariusze:

- rejestracja z metadata „admin” zostawia rolę klienta,
- `private.bootstrap_admin` działa jako operator; w `public` tej funkcji nie ma, a zalogowany dostaje odmowę uprawnień,
- w `public` nie ma funkcji `security definer`,
- opublikowanego pliku zdjęcia nie da się nadpisać ani skasować; nowa wersja to nowy plik, a stara migawka zostaje do kolejnej akceptacji,
- właściciel tworzy szkic, nie ustawia statusu „opublikowany” i nie woła akceptacji,
- drugi właściciel nie widzi i nie zmienia cudzego szkicu,
- gość nie czyta kopii roboczej, kontaktu wewnętrznego ani zdjęć roboczych,
- przed akceptacją gość nie widzi lokalu w migawce,
- administrator publikuje,
- po edycji gość nadal widzi poprzedni opis,
- właściciel nie gasi flagi „są nieopublikowane zmiany”,
- wyszukiwarka po mieście nie oddaje lokalu z innego miasta,
- obcy nie dopisuje się jako członek.

W tym środowisku `supabase start` nie dochodzi do końca: kontenery widzą siebie w sieci Dockera, ale połączenie TCP między nimi kończy się timeoutem (sprawdzone osobno, nie tylko przez CLI). Dlatego ten sam plik testu puszczony był bezpośrednio na obrazie Postgres Supabase, po migracji:

`psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/rls_security.test.sql`

Wynik po dopięciu `search_path`: 57 testów, wszystkie zaliczone, transakcja wycofana. Na zwykłym komputerze, gdzie `supabase start` wstaje, tą samą treść odpala `npm run test:security`.

Test `strona główna startuje sesję i katalog naraz` porównuje lokalny harmonogram: trzy zadania po 30 ms naraz kontra te same trzy po kolei. To nie jest czas podglądu Vercel ani projektu DEV. `React.cache` wokół sesji deduplikuje odczyt w jednym renderze strony; runner `node:test` nie ma tego renderu, więc tego mechanizmu tu nie mierzymy.

Nie uznaję za zaliczony testu, którego tu nie dało się uruchomić: pełnego stosu Supabase (Auth + Storage + PostgREST) przez `supabase start`. Publiczny odczyt i odmowa szkicu zostały sprawdzone dodatkowo przez PostgREST podłączony do tej samej bazy z sieci hosta: gość dostaje `permission denied` na tabeli `lokale`, a `szukaj_lokali` zwraca tylko opublikowany przykład.

## Czego test nie pokrywa

- prawdziwego wgrania pliku przez API Storage (polityki są w migracji; test SQL nie przechodzi przez serwer plików),
- wyglądu w przeglądarce na telefonie poza zrzutami z lokalnego serwera,
- projektu DEV w chmurze.
