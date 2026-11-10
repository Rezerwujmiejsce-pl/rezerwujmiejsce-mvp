# Tekst strony głównej

Dopóki administrator nic nie opublikuje, strona zostaje przy tekście zapisanym w aplikacji: nagłówek „Sala na każdą rodzinną okazję”, dotychczasowy podtytuł i `/img/hero.webp`. Kafle okazji idą wtedy w kolejności katalogu. Migracja nie wstawia przykładowego tekstu.

Szkic jest w `strona_szkic`. Czyta go tylko administrator. Gość dostaje odmowę uprawnień. Zapis szkicu nie zmienia `strona_publikacja`. Dopiero `opublikuj_strone` kopiuje szkic na stronę publiczną.

Baner to jeden z trzech plików już leżących w aplikacji: `/img/hero.webp`, `/img/hero-800.jpg`, `/img/sala-dworek.webp`. Adres z internetu i znaczniki HTML odpadają. Nie ma pobierania obcego pliku.

Lista lokali na stronie głównej zostaje wyszukiwaniem opublikowanych miejsc w Zielonej Górze. Osobnych „wyróżnionych lokali” na tej stronie nie ma, więc panel ich nie dodaje.

## Wdrożenie

Plik: `supabase/migrations/20261110091752_strona_glowna.sql`.

Wgrać po migracjach, które już są na DEV, albo razem z kolejką nowych plików, raz. Nie resetować DEV. Nie wstawiać ręcznie wiersza przykładowego. Brak wiersza w `strona_publikacja` jest poprawnym stanem: strona używa dotychczasowego tekstu. Jeśli tabeli jeszcze nie ma, strona też zostaje przy tym tekście i nie pokazuje błędu gościowi.
