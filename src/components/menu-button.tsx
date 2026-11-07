"use client";

export function MenuButton() {
  return (
    <button
      className="menu-btn"
      type="button"
      aria-expanded="false"
      aria-controls="nav-links"
      onClick={(event) => {
        const list = document.getElementById("nav-links");
        if (!list) return;
        const open = !list.classList.contains("open");
        list.classList.toggle("open", open);
        event.currentTarget.setAttribute("aria-expanded", String(open));
      }}
    >
      Menu
    </button>
  );
}
