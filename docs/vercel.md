# Gotowość pod Vercel — bez wdrożenia

Tego wycinka **nie wdrażamy**. Domena zostaje w OVH. Nie zmieniamy DNS, billingu ani strony `/test/`.

Gdy przyjdzie decyzja o podglądzie na Vercel, potrzebne będą:

| Zmienna | Gdzie | Uwaga |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, środowisko Preview albo osobny projekt | Adres API projektu DEV, nie produkcja, dopóki jej nie ma |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` albo klucz publishable | Vercel | Może być publiczny. Sam z siebie nie omija reguł RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | tylko jeśli kiedyś odpalimy skrypt administratora na serwerze | **Bez** przedrostka `NEXT_PUBLIC_`. Ta aplikacja go nie czyta w przeglądarce |

W projekcie Supabase, zanim wejdą prawdziwi ludzie:

- włącz potwierdzanie e-maila (lokalny `config.toml` ma je wyłączone tylko dla wygody na komputerze),
- dopisz adres podglądu Vercel do Redirect URLs,
- uruchom migrację z [migracje.md](migracje.md),
- nadaj administratora,
- zostaw `noindex`, dopóki to podgląd (jest w układzie strony).

Build sprawdza się lokalnie: `npm run build`. Nie wymaga klucza, strony i tak renderują się dynamicznie i przy braku zmiennych pokazują stan konfiguracji.

Nie podłączaj tego repozytorium do automatycznego deployu na domenę `rezerwujmiejsce.pl`, dopóki nie ma osobnej zgody.
