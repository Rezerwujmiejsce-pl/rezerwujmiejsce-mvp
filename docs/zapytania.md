# Zapytania o termin

To nie jest rezerwacja. Formularz zapisuje wiersz. Lokal widzi go w panelu. Nie wychodzi SMS ani e-mail. Nie ma zadatku, numeru rezerwacji, płatności ani kalendarza.

Gość bez konta może wysłać zapytanie i nie może go potem odczytać. Konto pokazuje wyłącznie wiersze, w których `klient_id` jest równe `auth.uid()` z chwili wysyłki. Nie szukamy starych zapytań po e-mailu ani telefonie.

Szacunek kwoty powstaje tylko z opublikowanej sali: cena za osobę razy liczba gości albo cena za salę. Cena za godzinę, dzień, pakiet i „cena na zapytanie” zostają bez jednej sumy. Nie ma tabeli pakietów.

Właściciel może zmienić status tylko z `nowe` na `odrzucone`. Nie ma funkcji, która ustawia `zaakceptowane`.

Makieta „Moje rezerwacje” jest tylko na desktop 1440. Karty „Zapłać zadatek” i „Potwierdzona” są w niej oznaczone jako przykładowe i nie są zbudowane. Zakładek Ulubione, Moje dane i Zakończone nie ma jako osobnych ekranów. Wąski ekran składa istniejącą kartę; to nie jest osobna klatka z Figmy.

## Wdrożenie na DEV

Plik jeszcze nie jest na projekcie `uksiphxyrpanubfjixhg`. Nie wgrywać go drugi raz po pierwszym zastosowaniu i nie ruszać dwóch wcześniejszych migracji.

1. Zdalna historia ma już tylko `20261107122010` i `20261110082734`.
2. Wgrać wyłącznie `supabase/migrations/20261110084306_zapytania_o_termin.sql`.
3. Nie uruchamiać `supabase db reset` na DEV i nie odpalać `supabase/przyklad/seed.sql`.
4. Nie wysyłać próbnego zapytania na lokal właściciela. Test ról jest w `supabase/tests/zapytania_rls.test.sql` i idzie na lokalnej bazie, w transakcji, która się cofa.
5. Po wdrożeniu anonimowy `select` z `zapytania` ma dostać odmowę, a `public.wyslij_zapytanie` ma zostać `security invoker`.

Świeża baza lokalna (`supabase db reset`) puszcza trzy pliki po kolei. Baza, która ma stare numery `20261107113350` albo `20261107122202`, nie jest zgodna z DEV — reset tylko u siebie.
