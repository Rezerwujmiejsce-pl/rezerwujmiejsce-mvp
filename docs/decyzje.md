# Ustalenia tymczasowe i pytania otwarte

Te rzeczy są świadomie prowizoryczne. Nie są progiem „8 zdjęć” ani „80% kompletności” — tych progów nie ma w kodzie. Nie ma też prowizji, bo płatności są poza wycinkiem.

## Co musi być, żeby wysłać lokal do weryfikacji

- nazwa (przynajmniej 2 znaki),
- miasto,
- końcówka adresu (uzupełnia się sama z nazwy, gdy pusta),
- co najmniej jedna widoczna sala z nazwą i liczbą gości,
- przy każdej widocznej sali albo kwota, albo „cena na zapytanie”.

Opis, zdjęcia i udogodnienia nie blokują wysyłki. Administrator może odesłać lokal z powodem. Lista jest w funkcji `private.waliduj_do_wyslania` i w `src/domain/rules.ts`.

## Cena

Jedna kwota „od” na salę, w groszach, waluta (domyślnie PLN) i jednostka: za salę, osobę, dzień, godzinę albo pakiet. Osobnych cen pn–czw i pt–nd jeszcze nie ma — w specyfikacji są, w tym wycinku nie, bo nie ma kalendarza. Gdy filtr „cena do” jest ustawiony, lokale wyłącznie „na zapytanie” odpadają, bo nie mamy liczby do porównania. Bez filtra ceny są widoczne.

## Miasto

Pole jest dowolnym tekstem. Formularz na stronie głównej startuje od „Zielona Góra”. Puste miasto w wyszukiwarce znaczy całą Polskę. Porównanie ignoruje wielkość liter i polskie znaki (`Zielona Góra` = `zielona gora`).

## Jedna przestrzeń

Lokal może nie dzielić się na sale. W bazie i tak jest jeden rekord sali („Cały lokal”), bo tam siedzą pojemność i cena. Przełącznik „jeden obiekt” jest informacją na stronie, nie zakazem dodania drugiej sali.

## Cykl życia

| Wartość w bazie | Po polsku |
| --- | --- |
| `draft` | szkic |
| `pending_review` | do weryfikacji |
| `published` | opublikowany |
| `rejected` | odrzucony |
| `archived` | ukryty |

Gość czyta tylko migawkę z chwili akceptacji (`lokal_publikacje` i tabele `opublikowane_*`). Edycja opublikowanego lokalu zostaje w kopii roboczej. Stara wersja zostaje na stronie, dopóki administrator znowu nie kliknie „Publikuj”. Odrzucenie zmian nie zdejmuje już opublikowanej wersji. Ukrycie kasuje migawkę.

Specyfikacja mówiła też „ukryty” zamiast osobnego „odrzucony”. Odrzucenie jest potrzebne, żeby właściciel dostał powód i mógł poprawić szkic, który nigdy nie wszedł na stronę.

## Zdjęcia

Koszyk `zdjecia-lokali` jest prywatny. Plik nieopublikowany nie ma publicznego adresu. Limit **8 MB** oraz typy JPEG, PNG i WebP to ograniczenie techniczne przed śmieciowymi plikami, nie wymóg liczby zdjęć. Serwer sprawdza nagłówek pliku, nie samą końcówkę nazwy.

## Kontakt i pieniądze

`lokal_dane_prywatne` trzyma e-mail, telefon wewnętrzny i notatkę. Nie trafiają do wyszukiwarki. Telefon publiczny jest osobnym polem i widać go na stronie lokalu, gdy właściciel go poda.

Nie ma IBAN, faktur, prowizji ani zadatku. Specyfikacja je opisuje. Ten wycinek ich nie buduje.

Zapytanie o termin jest zapisem w portalu. Gość może je wysłać bez konta i potem go nie odczyta. Zalogowany klient widzi tylko wiersze z `klient_id` równym jego `auth.uid()`. Stare zapytanie gościa nie dopina się po e-mailu ani telefonie. Właściciel może je odrzucić. Nie ma statusu, który tworzy rezerwację, płatność ani wpis do kalendarza.

## Czego świadomie nie ma na ekranach

Wyszukiwanie zdaniem, „wolne sob 14.11”, zadatek, płatność, potwierdzenie terminu, czat, serduszka ulubionych, sortowanie po najbliższym terminie. Mapa z prototypu była rysunkiem. Zamiast niej są linki do OpenStreetMap, gdy lokal ma współrzędne. Makieta konta ma karty zadatku i potwierdzonej rezerwacji — to dane przykładowe, nie ten etap. Nie ma też osobnych ekranów „Ulubione” i „Moje dane”. Wariant mobile konta nie jest w Figmie; wąski ekran składa kartę z istniejących klas.

## Pytania bez odpowiedzi

Zostają pytania z specyfikacji: prowizja i kto przyjmuje pieniądze, terminy odpowiedzi i zadatku, koszt zwrotu, czy rezerwujemy salę czy cały lokal przy wielu salach, kto dostarcza zdjęcia na start, faktury. Odpowiedzi nie zostały zgadnięte w kodzie. Zapytanie bez konta jest możliwe, ale nie wraca na konto samo.
