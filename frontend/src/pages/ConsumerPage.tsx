import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ActivityFeed } from "../components/ActivityFeed";
import { Onboarding } from "../components/Onboarding";
import { type AppView } from "../App";
import { type FeedEvent, type FeedRole } from "../useActivityFeed";

interface Props {
  program: any;
  readonlyProgram: any;
  onBack: () => void;
  onNavigate: (v: AppView) => void;
  events: FeedEvent[];
  relativeTime: (ts: number) => string;
  push: (type: string, label: string, role: FeedRole) => void;
}

function getObDismissed() {
  try { return localStorage.getItem("bottleneck_ob_consumer") === "1"; } catch { return false; }
}

export function ConsumerPage({ events, relativeTime }: Props) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  const [copied, setCopied] = useState(false);

  const [obDismissed, setObDismissed] = useState(getObDismissed);
  const dismissOnboarding = () => {
    setObDismissed(true);
    try { localStorage.setItem("bottleneck_ob_consumer", "1"); } catch {}
  };

  const onboardingSteps = [
    {
      label: "Połącz portfel",
      hint: "Kliknij 'Select Wallet' w prawym górnym rogu i zaloguj się Phantomem lub Solflare. Ustaw sieć na Devnet.",
      done: !!publicKey,
    },
    {
      label: "Skopiuj adres",
      hint: "Skopiuj adres portfela i pokaż go kasjerowi przy zwrocie butelki.",
      done: false,
    },
    {
      label: "Oddaj w sklepie",
      hint: "Idź do uczestniczącego sklepu z pustą butelką. Kasjer skanuje opakowanie i wpisuje Twój adres portfela — gotowe.",
      done: false,
    },
  ];

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 48px" }}>
        {!obDismissed && (
          <Onboarding steps={onboardingSteps} onDismiss={dismissOnboarding} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Wallet address card — hero */}
          <Card style={{
            gridColumn: "1 / -1",
            background: publicKey ? "var(--mint)" : "var(--surface)",
            border: "none",
          }}>
            <Label light={!!publicKey}>Twój adres portfela</Label>
            {publicKey ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <div style={{
                    fontFamily: "IBM Plex Mono, monospace", fontSize: 13, fontWeight: 500,
                    color: "#fff", wordBreak: "break-all", lineHeight: 1.5,
                  }}>
                    {publicKey.toBase58()}
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: copied ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontFamily: "Space Grotesk, sans-serif",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      flexShrink: 0,
                      marginLeft: 16,
                      transition: "background 0.15s",
                    }}
                  >
                    {copied ? "Skopiowano!" : "Kopiuj"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 10, lineHeight: 1.55 }}>
                  Pokaż ten adres kasjerowi przy zwrocie butelki. Sklep wpisuje go do systemu i wydaje kaucję przy ladzie.
                </p>
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
                  Połącz portfel, aby zobaczyć swój adres — potrzebny przy zwrocie butelki w sklepie.
                </p>
                <button
                  onClick={() => setVisible(true)}
                  style={{
                    background: "var(--ink)", color: "#fff", border: "none",
                    borderRadius: 8, padding: "10px 20px",
                    fontFamily: "Space Grotesk, sans-serif", fontWeight: 700,
                    fontSize: 13, cursor: "pointer",
                  }}
                >
                  Połącz portfel →
                </button>
              </div>
            )}
          </Card>

          {/* How refund works card */}
          <Card style={{ gridColumn: "1 / -1", background: "var(--mint-bg)", border: "1px solid var(--mint-ring)" }}>
            <Label>Jak działa zwrot kaucji</Label>
            <ol style={{ paddingLeft: 16, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Kupujesz napój w uczestniczącym sklepie — kaucja jest już zablokowana on-chain przez producenta.",
                "Wracasz z pustą butelką do dowolnego sklepu i pokazujesz kasjerowi adres swojego portfela.",
                "Kasjer skanuje opakowanie i wpisuje Twój adres — transakcja on-chain natychmiast zatwierdza zwrot.",
                "Kaucja wraca do Ciebie przy ladzie — gotówką lub przelewem, bez żadnych voucherów.",
              ].map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.55 }}>
                  {s}
                </li>
              ))}
            </ol>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, fontStyle: "italic" }}>
              Nie musisz nic robić on-chain — wystarczy Twój adres portfela.
            </p>
          </Card>
        </div>
      </div>

      {/* Consumer activity log */}
      <div style={{ width: 280, borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityFeed events={events} relativeTime={relativeTime} role="consumer" />
      </div>
    </div>
  );
}

// ── shared page primitives ────────────────────────────────────────────────────

export function PageContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "28px 32px 48px" }}>
      {children}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "22px 24px",
      boxShadow: "var(--shadow-sm)",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", fontFamily: "Space Grotesk, sans-serif",
      color: light ? "rgba(255,255,255,0.7)" : "var(--muted)",
    }}>
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)",
      textTransform: "uppercase", letterSpacing: "0.07em",
      fontFamily: "Space Grotesk, sans-serif", marginBottom: 6,
    }}>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: 8, color: "var(--ink)",
  fontFamily: "IBM Plex Mono, monospace", fontSize: 13,
  padding: "9px 12px", width: "100%", outline: "none",
};

export function Err({ msg, light }: { msg: string; light?: boolean }) {
  return (
    <div style={{
      fontSize: 11, marginTop: 8,
      fontFamily: "IBM Plex Mono, monospace",
      color: light ? "rgba(255,255,255,0.85)" : "var(--danger)",
    }}>
      {msg}
    </div>
  );
}
