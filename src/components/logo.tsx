const PETALS = [
  "M31.9999 31.2C38.9587 31.2 44.5999 25.5588 44.5999 18.6C44.5999 11.6412 38.9587 6 31.9999 6C25.0411 6 19.3999 11.6412 19.3999 18.6C19.3999 25.5588 25.0411 31.2 31.9999 31.2Z",
  "M44.7401 40.43C51.6989 40.43 57.3401 34.7888 57.3401 27.83C57.3401 20.8712 51.6989 15.23 44.7401 15.23C37.7814 15.23 32.1401 20.8712 32.1401 27.83C32.1401 34.7888 37.7814 40.43 44.7401 40.43Z",
  "M39.8798 55.37C46.8386 55.37 52.4798 49.7288 52.4798 42.77C52.4798 35.8113 46.8386 30.17 39.8798 30.17C32.921 30.17 27.2798 35.8113 27.2798 42.77C27.2798 49.7288 32.921 55.37 39.8798 55.37Z",
  "M24.12 55.37C31.0788 55.37 36.72 49.7288 36.72 42.77C36.72 35.8113 31.0788 30.17 24.12 30.17C17.1612 30.17 11.52 35.8113 11.52 42.77C11.52 49.7288 17.1612 55.37 24.12 55.37Z",
  "M19.2602 40.43C26.2189 40.43 31.8602 34.7888 31.8602 27.83C31.8602 20.8712 26.2189 15.23 19.2602 15.23C12.3014 15.23 6.66016 20.8712 6.66016 27.83C6.66016 34.7888 12.3014 40.43 19.2602 40.43Z",
];

export function Sygnet({ petal, center }: { petal: string; center: string }) {
  return (
    <svg className="sygnet" viewBox="0 0 64 64" aria-hidden="true">
      {PETALS.map((d) => (
        <path key={d} d={d} fill={petal} />
      ))}
      <circle cx="32" cy="32" r="9" fill={center} />
    </svg>
  );
}

/** Wariant C: sygnet i żywy napis. Jasny na białym, ciemny na nakładce. */
export function LogoLockup({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  const dark = tone === "dark";
  const classes = ["logo-lockup", dark ? "on-dark" : "", compact ? "compact" : ""].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <Sygnet petal={dark ? "#DA8698" : "#C23654"} center={dark ? "#141414" : "#FFFCF8"} />
      <span className="wordmark">
        rezerwujmiejsce<span className="dot">.</span>pl
      </span>
    </span>
  );
}
