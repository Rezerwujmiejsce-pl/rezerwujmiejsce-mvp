# rezerwujmiejsce.pl — pierwszy wycinek

Właściciel zakłada konto, opisuje lokal (sale, zdjęcia, udogodnienia, okazje, cenę) i wysyła go do sprawdzenia. Administrator publikuje. Gość bez konta wyszukuje tylko opublikowane lokale, otwiera stronę lokalu i może zapytać o termin. Zalogowany klient widzi na koncie tylko zapytania wysłane z tego konta.

To nie jest jeszcze rezerwacja. Nie ma płatności, zadatku, SMS-ów, kalendarza wolnych terminów, opinii ani porównywania. Zapis zapytania nie wysyła wiadomości.

## Dla Wojtka, bez linii poleceń

Aplikacja jest w tym repozytorium, na osobnej gałęzi, w pull requeście do przejrzenia. Niczego nie wgrano na OVH, nie ruszano domeny, `/test/` ani hostingu produkcyjnego.

Żeby zobaczyć stronę u siebie, potrzebny jest ktoś, kto uruchomi lokalną bazę według [docs/uruchomienie.md](docs/uruchomienie.md). Bez uzupełnionego pliku `.env.local` strona mówi wprost, że bazy nie ma — nie pokazuje wymyślonych sal.

Rola administratora nie powstaje przy pierwszej rejestracji. Nadaje ją osobna komenda opisana w [docs/administrator.md](docs/administrator.md).

## Co jest w środku

- Next.js (TypeScript) — strony i akcje serwera.
- Supabase lokalnie: Postgres, logowanie, pliki zdjęć.
- Migracja SQL z regułami, kto co widzi.
- Warstwa `src/domain` (reguły, bez bazy) i `src/data` (odczyt i zapis). Dzięki temu później da się podmienić Supabase na własny backend bez przerabiania ekranów od zera.

## Dokumenty

| Plik | Po co |
| --- | --- |
| [docs/uruchomienie.md](docs/uruchomienie.md) | Jak włączyć bazę i stronę na komputerze |
| [docs/testy.md](docs/testy.md) | Jak powtórzyć testy i co sprawdziły |
| [docs/administrator.md](docs/administrator.md) | Jak nadać rolę administratora |
| [docs/bezpieczenstwo.md](docs/bezpieczenstwo.md) | Kto co widzi, zdjęcia po publikacji, cache |
| [docs/migracje.md](docs/migracje.md) | Który plik SQL wgrać na pusty projekt DEV |
| [docs/vercel.md](docs/vercel.md) | Czego trzeba, zanim kiedyś wrzucimy to na Vercel. Jeszcze nie wrzucamy |
| [docs/decyzje.md](docs/decyzje.md) | Tymczasowe ustalenia i pytania bez odpowiedzi |

Na projekcie DEV są już dwie pierwsze migracje. Pliku zapytań `supabase/migrations/20261110084306_zapytania_o_termin.sql` tam nie wgrano. Jak go wdrożyć: [docs/zapytania.md](docs/zapytania.md).
