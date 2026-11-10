# Zapytania o termin

To nie jest rezerwacja. Formularz zapisuje wiersz. Lokal widzi go w panelu. Nie wychodzi SMS ani e-mail. Nie ma zadatku, numeru rezerwacji, płatności ani kalendarza.

Gość bez konta może wysłać zapytanie i nie może go potem odczytać. Konto pokazuje wyłącznie wiersze, w których `klient_id` jest równe `auth.uid()` z chwili wysyłki. Nie szukamy starych zapytań po e-mailu ani telefonie.

Potwierdzenie zapisu nie jest parametrem adresu. Po udanym zapisie przeglądarka dostaje ciasteczko `httpOnly` z identyfikatorem wiersza. Strona `/wyslane` mówi „zapisaliśmy” tylko wtedy, gdy `czy_swieze_zapytanie` widzi ten wiersz z ostatnich 10 minut i należy on do gościa albo do zalogowanej osoby. Samo wejście na adres, także z `?zapis=1`, nic nie potwierdza i nie niesie e-maila ani telefonu. Do tego służy `supabase/migrations/20261110092221_potwierdzenie_zapytania.sql`.

Limit 8 zapytań na godzinę z jednego adresu i 40 na lokal jest liczony pod blokadą transakcji (`20261110092253_zapytania_limit_i_odczyt.sql`), żeby dwa równoległe zapisy nie przeskoczyły progu. Adres e-mail nie jest potwierdzony: da się podać cudzy albo za każdym razem inny. Nie ma limitu na adres IP i nie ma CAPTCHA. To nie jest ochrona przed botem ani gotowość produkcyjna.

Szacunek kwoty powstaje tylko z opublikowanej sali: cena za osobę razy liczba gości albo cena za salę. Cena za godzinę, dzień, pakiet i „cena na zapytanie” zostają bez jednej sumy. Nie ma tabeli pakietów.

Właściciel może zmienić status tylko z `nowe` na `odrzucone`. Nie ma funkcji, która ustawia `zaakceptowane`.

Makieta „Moje rezerwacje” jest tylko na desktop 1440. Karty „Zapłać zadatek” i „Potwierdzona” są w niej oznaczone jako przykładowe i nie są zbudowane. Zakładek Ulubione, Moje dane i Zakończone nie ma jako osobnych ekranów. Wąski ekran składa istniejącą kartę; to nie jest osobna klatka z Figmy.

## Wdrożenie na DEV

`20261110091341` / `zapytania_o_termin` jest już na projekcie `uksiphxyrpanubfjixhg`. Nie wgrywać tego pliku drugi raz. W repozytorium nazywa się tak samo. Starego numeru `20261110084306` na DEV nie ma.

Jeszcze nie wgrane, po kolei:

Te dwa pliki są już na DEV jako `20261110092221` i `20261110092253`. Nie wgrywać ich drugi raz.

Nie uruchamiać `supabase db reset` na DEV, nie odpalać `supabase/przyklad/seed.sql` i nie wysyłać próbnego zapytania na lokal właściciela. Test ról idzie lokalnie i cofa transakcję. Po wdrożeniu `public.wyslij_zapytanie` zostaje `security invoker`, a w `private.wyslij_zapytanie` jest `pg_advisory_xact_lock`.
