export function InquirySteps({ stage }: { stage: "form" | "saved" }) {
  return (
    <ol className="stepsbar" aria-label="Etapy">
      <li className="on">
        <i>{stage === "saved" ? "✓" : "1"}</i>
        {stage === "saved" ? "Zapytanie zapisane" : "Zapytanie"}
      </li>
      <li className={stage === "saved" ? "wait" : undefined} aria-current={stage === "saved" ? "step" : undefined}>
        <i>2</i>
        {stage === "saved" ? "Czeka w panelu lokalu" : "Odpowiedź lokalu"}
      </li>
      <li className="later">
        <i>3</i> Zadatek <span className="help">jeszcze nie</span>
      </li>
      <li className="later">
        <i>4</i> Potwierdzenie <span className="help">jeszcze nie</span>
      </li>
    </ol>
  );
}
