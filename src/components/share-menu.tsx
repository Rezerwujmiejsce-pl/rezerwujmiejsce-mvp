"use client";

import { useEffect, useId, useState } from "react";

const NETWORKS = [
  ["copy", "Kopiuj link", "link"],
  ["facebook", "Facebook", "facebook"],
  ["x", "X", "x"],
  ["linkedin", "LinkedIn", "linkedin"],
  ["whatsapp", "WhatsApp", "whatsapp"],
  ["email", "E-mail", "email"],
  ["telegram", "Telegram", "telegram"],
  ["threads", "Threads", "threads"],
  ["bluesky", "Bluesky", "bluesky"],
  ["reddit", "Reddit", "reddit"],
  ["wykop", "Wykop", "wykop"],
] as const;

function hrefFor(net: string, url: string, text: string): string | null {
  const u = encodeURIComponent(url);
  const tx = encodeURIComponent(text);
  const both = encodeURIComponent(`${text} ${url}`);
  switch (net) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://x.com/intent/post?url=${u}&text=${tx}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "whatsapp":
      return `https://wa.me/?text=${both}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent("rezerwujmiejsce.pl")}&body=${both}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${tx}`;
    case "threads":
      return `https://www.threads.net/intent/post?text=${both}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${both}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${u}&title=${tx}`;
    case "wykop":
      return `https://wykop.pl/dodaj/link?url=${u}&title=${tx}`;
    default:
      return null;
  }
}

export function ShareMenu({ path, light }: { path: string; light?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(path);
  const [message, setMessage] = useState("");
  const text = "Sale na rodzinne okazje – rezerwujmiejsce.pl";

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link skopiowany.");
    } catch {
      setMessage(url);
    }
  }

  return (
    <div className="share-menu nav-share" data-share-menu>
      <button
        type="button"
        className={light ? "nav-btn share-trigger" : "share-pill share-trigger"}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Udostępnij"
        onClick={() => setOpen((value) => !value)}
      >
        <img src={light ? "/img/icons/share-white.svg" : "/img/icons/share.svg"} width={18} height={18} alt="" />
        <span className="share-label">Udostępnij</span>
      </button>
      <div className="share-pop" id={id} role="menu" hidden={!open}>
        <div className="share-grid">
          {NETWORKS.map(([net, label, icon]) => {
            const href = hrefFor(net, url, text);
            if (!href) {
              return (
                <button key={net} type="button" role="menuitem" onClick={copy}>
                  <img src={`/img/icons/${icon}.svg`} width={20} height={20} alt="" />
                  {label}
                </button>
              );
            }
            return (
              <a key={net} role="menuitem" href={href} target={net === "email" ? undefined : "_blank"} rel="noopener noreferrer">
                <img src={`/img/icons/${icon}.svg`} width={20} height={20} alt="" />
                {label}
              </a>
            );
          })}
        </div>
        <p className="share-pop-msg" role="status">{message}</p>
      </div>
    </div>
  );
}
