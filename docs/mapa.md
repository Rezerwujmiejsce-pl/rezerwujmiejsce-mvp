# Mapa wyników

Makieta w Figmie (`12:477`, `13:619`) ma narysowany podkład i pinezki z cenami. To ilustracja: pozycje x/y nie są współrzędnymi, a kwoty na pinezkach nie są danymi. Nie wstawiamy ich do bazy.

Pinezka powstaje tylko wtedy, gdy opublikowana migawka ma obie wartości `lat` i `lng`. Wyszukiwanie czyta je z `lokal_publikacje`, nie ze szkicu. Zmiana współrzędnych w panelu nie rusza pinezki, dopóki administrator nie opublikuje nowej migawki. Gość nie czyta tabeli `lokale`.

Adres nie jest zamieniany na pinezkę. Nie ma geokodera i nie ma hurtowego odpytywania żadnej usługi. Właściciel wpisuje obie liczby albo zostawia obie puste.

Cena na pinezce to „od” plus najniższa opublikowana kwota sali. Gdy jej nie ma, pinezka mówi „na zapytanie” albo „bez ceny”. Nie pokazujemy kwot z makiety.

Podkład to styl `https://tiles.openfreemap.org/styles/liberty` (OpenFreeMap, dane OpenStreetMap, schemat OpenMapTiles). Publiczna instancja nie wymaga klucza. Warunki z 14 października 2026 pozwalają na użycie, w tym komercyjne, „jak jest”, bez SLA. Atrybucję dokłada MapLibre. Kafelki ładują się dopiero, gdy mapa jest otwarta. Na wąskim ekranie startuje lista, a przycisk „Mapa” / „Lista” przełącza widok. W Figmie nie ma ramki otwartej mapy na telefonie, więc to nie jest odtworzenie takiej ramki.

„Szukaj w tym obszarze” zawęża już pobrany wynik do widocznego prostokąta. Nie dopytuje świata i nie zgaduje lokali bez współrzędnych.

Produkcja nie jest tu ustawiana. Przed nią trzeba ponownie przeczytać warunki OpenFreeMap. Publiczny serwer kafelków openstreetmap.org nie jest używany, bo jego zasady nie są dla aplikacji.
