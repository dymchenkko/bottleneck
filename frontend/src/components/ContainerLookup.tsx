import { useState } from "react";
import { pdas } from "../useProgram";
import { ActionBtn } from "./ActionBtn";

interface Props {
  readonlyProgram: any;
}

interface ContainerData {
  containerId: number;
  containerType: string;
  depositLamports: number;
  status: string;
  producer: string;
  registeredSlot: number;
}

const STEP_LABELS = ["W obiegu", "Zwrócone", "Rozliczone"];
const STATUS_INDEX: Record<string, number> = {
  inCirculation: 0,
  returned: 1,
  settled: 2,
};

function shortPk(pk: string) {
  return pk.slice(0, 6) + "…" + pk.slice(-6);
}

export function ContainerLookup({ readonlyProgram }: Props) {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContainerData | null>(null);
  const [err, setErr] = useState("");

  const lookup = async () => {
    if (!id || !readonlyProgram) return;
    setErr(""); setData(null); setLoading(true);
    try {
      const pda = pdas.container(BigInt(id));
      const c = await readonlyProgram.account.container.fetch(pda);
      const statusKey = Object.keys(c.status)[0];
      const typeKey = Object.keys(c.containerType)[0];
      setData({
        containerId: c.containerId.toNumber(),
        containerType: typeKey,
        depositLamports: c.depositLamports.toNumber(),
        status: statusKey,
        producer: c.producer.toBase58(),
        registeredSlot: c.registeredSlot.toNumber(),
      });
    } catch {
      setErr("Opakowanie nie znalezione.");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = data ? (STATUS_INDEX[data.status] ?? 0) : -1;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "20px",
    }}>
      <div style={{
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 11, fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: "var(--muted)", marginBottom: 14,
      }}>
        Wyszukaj opakowanie
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Podaj ID"
          style={{
            flex: 1, background: "var(--bg)",
            border: "1px solid var(--border)", borderRadius: 6,
            color: "var(--ink)", fontFamily: "IBM Plex Mono, monospace",
            fontSize: 13, padding: "7px 10px", outline: "none", minWidth: 0,
          }}
        />
        <ActionBtn onClick={lookup} loading={loading} disabled={!id}>
          Szukaj
        </ActionBtn>
      </div>

      {err && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--danger)", fontFamily: "IBM Plex Mono, monospace" }}>
          {err}
        </div>
      )}

      {data && (
        <div style={{ marginTop: 16 }}>
          {/* Status stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
            {STEP_LABELS.map((label, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: active || done ? "var(--mint)" : "var(--border-mid)",
                      opacity: done ? 0.5 : 1,
                      border: active ? "2px solid var(--surface)" : "none",
                      marginBottom: 4,
                    }} />
                    <span style={{
                      fontSize: 10,
                      color: active ? "var(--ink)" : "var(--muted)",
                      fontFamily: "Space Grotesk, sans-serif",
                      fontWeight: active ? 600 : 400,
                      textAlign: "center",
                    }}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{
                      height: 1, flex: 1,
                      background: i < stepIndex ? "var(--mint)" : "var(--border)",
                      opacity: i < stepIndex ? 0.5 : 1,
                      marginBottom: 18,
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Fields */}
          {[
            { label: "Typ", value: data.containerType.toUpperCase() },
            { label: "Kaucja", value: (data.depositLamports / 1_000_000).toFixed(2) + " PLN" },
            { label: "Producent", value: shortPk(data.producer) },
            { label: "Slot rejestracji", value: String(data.registeredSlot) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between",
              paddingBottom: 8, marginBottom: 8,
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "var(--ink)" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
