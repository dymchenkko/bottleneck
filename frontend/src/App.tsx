import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useProgram } from "./useProgram";
import { useSystemState } from "./useSystemState";
import { useActivityFeed } from "./useActivityFeed";
import { RolePicker } from "./components/RolePicker";
import { ConsumerPage } from "./pages/ConsumerPage";
import { StorePage } from "./pages/StorePage";
import { ProducerPage } from "./pages/ProducerPage";
import { DashboardPage } from "./pages/DashboardPage";

export type AppView = "consumer" | "store" | "producer" | "dashboard";

const ROLE_LABELS: Record<AppView, { label: string; icon: string }> = {
  consumer:  { label: "Klient",    icon: "🛒" },
  store:     { label: "Sklep",     icon: "🏪" },
  producer:  { label: "Producent", icon: "🏭" },
  dashboard: { label: "Panel",     icon: "📊" },
};

function getSavedRole(): AppView | null {
  try {
    const v = localStorage.getItem("bottleneck_role");
    return v as AppView | null;
  } catch {
    return null;
  }
}

export default function App() {
  const [role, setRole] = useState<AppView | null>(getSavedRole);
  const { disconnect, select, publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { program, readonlyProgram } = useProgram();
  const { state } = useSystemState(readonlyProgram);
  const { events, relativeTime, push } = useActivityFeed(readonlyProgram);

  const handleSelect = (r: AppView) => {
    setRole(r);
    try { localStorage.setItem("bottleneck_role", r); } catch {}
  };

  const handleChangeRole = () => {
    disconnect().catch(() => {});
    select(null as any);
    setRole(null);
    try { localStorage.removeItem("bottleneck_role"); } catch {}
  };

  if (!role) {
    return <RolePicker onSelect={handleSelect} />;
  }

  const meta = ROLE_LABELS[role];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Minimal header */}
      <header
        style={{
          height: 56,
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Left: logo + role */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Bottleneck
          </span>

          <div style={{ width: 1, height: 20, background: "var(--border)" }} />

          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            {meta.label}
          </span>
        </div>

        {/* Right: devnet + change role + wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--mint)",
              background: "var(--mint-bg)",
              border: "1px solid var(--mint-ring)",
              borderRadius: 5,
              padding: "3px 8px",
            }}
          >
            devnet
          </span>

          <button
            onClick={handleChangeRole}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 7,
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 600,
              color: "var(--muted)",
              cursor: "pointer",
              transition: "border-color 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-mid)";
              (e.currentTarget as HTMLElement).style.color = "var(--ink)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--muted)";
            }}
          >
            Zmień rolę
          </button>

          {connected && publicKey ? (
            <button
              onClick={() => { select(null as any); disconnect().catch(() => {}); }}
              title="Odłącz portfel. Aby zmienić konto w Phantom: otwórz rozszerzenie → kliknij ikonę konta → wybierz inne — dApp zaktualizuje się automatycznie."
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "5px 12px",
                fontSize: 12,
                fontFamily: "IBM Plex Mono, monospace",
                fontWeight: 500,
                color: "var(--ink)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "border-color 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-mid)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
              <span style={{ color: "var(--muted)", fontFamily: "Space Grotesk, sans-serif", fontSize: 11 }}>
                · odłącz
              </span>
            </button>
          ) : (
            <button
              onClick={() => setVisible(true)}
              title="Połącz portfel Phantom lub Solflare"
              style={{
                background: "var(--ink)",
                border: "none",
                borderRadius: 7,
                padding: "5px 12px",
                fontSize: 12,
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Połącz portfel
            </button>
          )}
        </div>
      </header>

      {/* Page */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {role === "consumer" && (
          <ConsumerPage
            program={program}
            readonlyProgram={readonlyProgram}
            onBack={handleChangeRole}
            onNavigate={handleSelect}
            events={events}
            relativeTime={relativeTime}
            push={push}
          />
        )}
        {role === "store" && (
          <StorePage
            program={program}
            readonlyProgram={readonlyProgram}
            onBack={handleChangeRole}
            events={events}
            relativeTime={relativeTime}
            push={push}
          />
        )}
        {role === "producer" && (
          <ProducerPage
            program={program}
            state={state}
            onBack={handleChangeRole}
            events={events}
            relativeTime={relativeTime}
            push={push}
          />
        )}
        {role === "dashboard" && (
          <DashboardPage
            program={program}
            readonlyProgram={readonlyProgram}
            state={state}
            events={events}
            relativeTime={relativeTime}
            onBack={handleChangeRole}
            push={push}
          />
        )}
      </div>
    </div>
  );
}
