# Administrator

Pierwsze konto na stronie jest zwykłym klientem. Przycisk „Załóż konto właściciela” zmienia rolę na właściciela lokalu. Nie zmienia jej na administratora.

Administratora nadaje operator bazy, po tym jak ta osoba już ma konto (zarejestrowała się albo została dodana w Authentication).

## Sposób 1 — edytor SQL

W lokalnym Studio albo, później, w SQL Editorze projektu DEV (jako rola postgres):

```sql
select public.bootstrap_admin('twoj-adres@poczta.pl');
```

Funkcja odmawia, gdy woła ją zalogowany użytkownik strony. Działa dla operatora bazy (`postgres` / `supabase_admin`) i dla klucza service role.

Po nadaniu roli wyloguj się i zaloguj ponownie.

## Sposób 2 — skrypt

W `.env.local` musi być `SUPABASE_SERVICE_ROLE_KEY` oraz adres API. Potem:

```bash
npm run admin:bootstrap -- twoj-adres@poczta.pl
```

Jeśli adres nie jest lokalny, skrypt staje i prosi o `ALLOW_REMOTE_BOOTSTRAP=yes`. Dzięki temu przypadkiem nie nadamy roli na zdalnym projekcie.

## Czego strona nie robi

- Nie ma przycisku „zrób mnie administratorem”.
- Administrator na stronie nie nadaje tej roli innym. Kolejne konto administratora to znowu `bootstrap_admin`.
- Publikacja, odrzucenie i ukrycie lokalu idą przez funkcje bazy. Właściciel, który je wywoła, dostaje odmowę.

Wejście: po zalogowaniu na konto administratora link „Weryfikacja” albo adres `/admin`.
