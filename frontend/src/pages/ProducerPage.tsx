import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ActionBtn } from "../components/ActionBtn";
import { TxLink } from "../components/TxLink";
import { ActivityFeed } from "../components/ActivityFeed";
import { Onboarding } from "../components/Onboarding";
import { pdas } from "../useProgram";
import { type SystemState } from "../useSystemState";
import { PageContent, Card, Label, FieldLabel, Err, inputStyle } from "./ConsumerPage";
import { type FeedEvent, type FeedRole } from "../useActivityFeed";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  program: any; state: SystemState; onBack: () => void;
  events: FeedEvent[]; feedLoading?: boolean; relativeTime: (ts: number) => string;
  push: (type: string, label: string, role: FeedRole) => void;
}

function getObDismissed() {
  try { return localStorage.getItem("bottleneck_ob_producer") === "1"; } catch { return false; }
}

export function ProducerPage({ program, state, events, feedLoading, relativeTime, push }: Props) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const isMobile = useIsMobile();
  const nextId = String(state.totalInCirculation + state.totalReturned + 1);

  const [id, setId] = useState("");
  const [type, setType] = useState<"pet" | "glass">("pet");
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");
  const [history, setHistory] = useState<{ id: string; type: string; tx: string }[]>([]);

  const [obDismissed, setObDismissed] = useState(getObDismissed);
  const dismissOnboarding = () => {
    setObDismissed(true);
    try { localStorage.setItem("bottleneck_ob_producer", "1"); } catch {}
  };

  const onboardingSteps = [
    {
      label: "Połącz portfel",
      hint: "Zaloguj się portfelem producenta. Upewnij się, że masz wystarczająco SOL na kaucję i opłaty transakcyjne (sieć Devnet).",
      done: !!publicKey,
    },
    {
      label: "Zarejestruj opakowanie",
      hint: `Wpisz ID opakowania (sugerowane: #${nextId}), wybierz typ i kliknij Zarejestruj. Kaucja zostanie zablokowana w skarbcu.`,
      done: history.length > 0,
    },
  ];

  const deposit = type === "glass"
    ? (state.depositGlass / 1_000_000).toFixed(2)
    : (state.depositPet / 1_000_000).toFixed(2);


  const handle = async () => {
    if (!publicKey) { setVisible(true); return; }
    if (!program) return;
    setErr(""); setTx(""); setLoading(true);
    try {
      const bid = BigInt(id);
      const sig = await program.methods
        .registerContainer(new BN(bid.toString()), type === "glass" ? { glass: {} } : { pet: {} })
        .accounts({
          producer: publicKey,
          container: pdas.container(bid),
          config: pdas.config(),
          vault: pdas.vault(),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });
      setTx(sig);
      setHistory(h => [{ id, type, tx: sig }, ...h]);
      setId(String(Number(bid) + 1));
      const deposit = type === "glass" ? state.depositGlass : state.depositPet;
      push("registered", `#${id} zarejestrowane · ${(deposit / 1_000_000).toFixed(2)} PLN · ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`, "producer");
    } catch (e: any) { setErr(parseErr(e)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px 24px" : "28px 28px 48px" }}>
        {!obDismissed && (
          <Onboarding steps={onboardingSteps} onDismiss={dismissOnboarding} />
        )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>

        {/* System snapshot */}
        {[
          { label: "W obiegu", value: String(state.totalInCirculation), accent: true },
          { label: "Kaucja PET", value: (state.depositPet / 1_000_000).toFixed(2) + " PLN", accent: false },
          { label: "Kaucja szklana", value: (state.depositGlass / 1_000_000).toFixed(2) + " PLN", accent: false },
        ].map(({ label, value, accent }) => (
          <Card key={label} style={accent ? { background: "var(--mint-bg)", border: "1px solid var(--mint-ring)" } : {}}>
            <Label>{label}</Label>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 28, fontWeight: 500, color: accent ? "var(--mint)" : "var(--ink)", marginTop: 8, lineHeight: 1 }}>
              {value}
            </div>
          </Card>
        ))}

        {/* Register form */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <Label>Zarejestruj opakowanie</Label>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 20, lineHeight: 1.55 }}>
            Każda rejestracja blokuje kaucję z Twojego portfela w skarbcu on-chain.
            Następne dostępne ID to{" "}
            <span style={{ fontFamily: "IBM Plex Mono, monospace", color: "var(--mint)" }}>#{nextId}</span>.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>ID opakowania</FieldLabel>
              <input type="number" value={id} onChange={e => setId(e.target.value)} placeholder={nextId} style={inputStyle} />
            </div>
            <div>
              <FieldLabel>Typ</FieldLabel>
              <select value={type} onChange={e => setType(e.target.value as "pet" | "glass")} style={inputStyle as React.CSSProperties}>
                <option value="pet">Butelka PET / Puszka — kaucja 0,50 PLN</option>
                <option value="glass">Butelka szklana — kaucja 1,00 PLN</option>
              </select>
            </div>
          </div>

          {id && (
            <div style={{
              background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "10px 14px", marginBottom: 16, fontSize: 12,
              color: "var(--muted)", fontFamily: "IBM Plex Mono, monospace",
            }}>
              Opakowanie #{id} · {type.toUpperCase()} · <strong style={{ color: "var(--ink)" }}>{deposit} PLN</strong> zostanie zablokowane w skarbcu
            </div>
          )}

          <ActionBtn onClick={handle} loading={loading} disabled={!id}>
            {!publicKey ? "Połącz portfel →" : `Zarejestruj opakowanie #${id || "?"}`}
          </ActionBtn>
          {tx && <TxLink sig={tx} />}
          {err && <Err msg={err} />}
        </Card>

        {/* Session history */}
        {history.length > 0 && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <Label>Zarejestrowane w tej sesji</Label>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 0 }}>
              {history.map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                      #{r.id}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: "Space Grotesk, sans-serif",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      color: "var(--mint)", background: "var(--mint-bg)",
                      padding: "2px 7px", borderRadius: 4,
                    }}>
                      {r.type}
                    </span>
                  </div>
                  <a
                    href={`https://explorer.solana.com/tx/${r.tx}?cluster=devnet`}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--mint)", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    {r.tx.slice(0, 8)}… ↗
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      </div>
      {/* Producer activity log */}
      <div style={isMobile
        ? { height: 200, borderTop: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
        : { width: 280, borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
      }>
        <ActivityFeed events={events} loading={feedLoading} relativeTime={relativeTime} role="producer" />
      </div>
    </div>
  );
}

function parseErr(e: any): string {
  console.error(e);
  const msg: string = e?.message ?? String(e);
  const logs: string[] = e?.logs ?? [];
  const combined = msg + "\n" + logs.join("\n");
  const m = combined.match(/Error Code: (\w+)\./);
  if (m) return m[1];
  if (msg.includes("already in use")) return "To ID opakowania już istnieje — wybierz inne.";
  if (msg.includes("insufficient funds") || msg.includes("insufficient lamports")) return "Niewystarczające saldo SOL — doładuj portfel na devnet.";
  if (msg.includes("User rejected") || msg.includes("rejected the request")) return "Transakcja anulowana.";
  if (msg.toLowerCase().includes("unexpected") || msg.includes("0x1") || msg.includes("block height exceeded") || msg.includes("not found")) {
    return "Błąd sieci — upewnij się, że Phantom jest ustawiony na Devnet (Settings → Developer Settings → Testnet Mode lub Network → Devnet).";
  }
  return (msg.split("\n")[0] ?? msg).slice(0, 140);
}
