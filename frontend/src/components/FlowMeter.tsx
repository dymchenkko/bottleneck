import { type SystemState } from "../useSystemState";

interface Props {
  state: SystemState;
}

export function FlowMeter({ state }: Props) {
  const { totalInCirculation, totalReturned, totalUnclaimedLamports, depositPet } = state;

  const swept = depositPet > 0
    ? Math.round(totalUnclaimedLamports / depositPet)
    : 0;

  const total = totalInCirculation + totalReturned + swept;

  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(2) : "0";

  const circulationPct = pct(totalInCirculation);
  const returnedPct = pct(totalReturned);
  const sweptPct = pct(swept);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--muted)",
        }}>
          Przepływ opakowań
        </span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--muted)" }}>
          {total} szt.
        </span>
      </div>

      <div
        style={{
          height: 12, borderRadius: 6, background: "var(--border)",
          overflow: "hidden", display: "flex", border: "1px solid var(--border-mid)",
        }}
        role="meter"
        aria-label={`Przepływ: ${totalInCirculation} w obiegu, ${totalReturned} zwrócono, ${swept} odzyskano`}
        aria-valuenow={total} aria-valuemin={0} aria-valuemax={total}
      >
        <div className="flow-bar-segment" style={{ width: `${circulationPct}%`, background: "var(--mint)", opacity: 0.9 }}
          title={`W obiegu: ${totalInCirculation}`} />
        <div className="flow-bar-segment" style={{ width: `${returnedPct}%`, background: "var(--mint)", opacity: 0.4 }}
          title={`Zwrócono: ${totalReturned}`} />
        <div className="flow-bar-segment" style={{ width: `${sweptPct}%`, background: "var(--amber)", opacity: 0.85 }}
          title={`Odzyskano: ${swept}`} />
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        {[
          { color: "var(--mint)", opacity: 0.9,  label: "W obiegu",  value: totalInCirculation },
          { color: "var(--mint)", opacity: 0.4,  label: "Zwrócono",  value: totalReturned },
          { color: "var(--amber)", opacity: 0.85, label: "Odzyskano", value: swept },
        ].map(({ color, opacity, label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
            <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "var(--ink)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
