"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extensionFor, PHOTO_MAX_BYTES, sniffImage } from "../domain/rules";
import { createBrowserSupabase } from "../data/supabase/browser";
import { registerPhoto } from "../app/panel/actions";

export function PhotoUploader({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage("");
    if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) {
      setMessage("Plik musi mieć najwyżej 8 MB. To limit techniczny, nie wymóg liczby zdjęć.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) {
      setMessage("Wybierz plik JPEG, PNG albo WebP.");
      return;
    }
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setMessage("Brak konfiguracji bazy w przeglądarce.");
      return;
    }
    const id = crypto.randomUUID();
    const ext = extensionFor(mime);
    const path = `${venueId}/${id}.${ext}`;
    setPending(true);
    const uploaded = await supabase.storage.from("zdjecia-lokali").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploaded.error) {
      setPending(false);
      setMessage("Nie udało się wgrać pliku. Zaloguj się jako osoba przypisana do tego lokalu.");
      return;
    }
    const formData = new FormData();
    formData.set("lokal", venueId);
    formData.set("id", id);
    formData.set("ext", ext);
    try {
      await registerPhoto(formData);
    } catch (error) {
      // redirect() rzuca wyjątek, który Next obsługuje. Inny błąd sprzątamy.
      if (error && typeof error === "object" && "digest" in error) throw error;
      await supabase.storage.from("zdjecia-lokali").remove([path]);
      setPending(false);
      setMessage("Zdjęcie nie zostało dopisane do lokalu.");
      return;
    }
    router.refresh();
  }

  return (
    <label>
      Dodaj zdjęcie
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={pending} />
      <span className="help">{pending ? "Wgrywanie…" : message || "JPEG, PNG lub WebP, do 8 MB. Kolejność i okładkę ustawisz pod spodem."}</span>
    </label>
  );
}
