import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SystemProgram } from "@solana/web3.js";
import { BN, pdas, lamportsToDisplay } from "../useProgram";
import { useConsumerBalance } from "../useRoleBalances";
import { ActivityFeed } from "../components/ActivityFeed";
import { Onboarding } from "../components/Onboarding";
import { ActionBtn } from "../components/ActionBtn";
import { TxLink } from "../components/TxLink";
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

export function ConsumerPage({ program, readonlyProgram, events, relativeTime, push }: Props) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [copied, setCopied] = useState(false);

  // Purchase form
  const [buyId, setBuyId] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyErr, setBuyErr] = useState("");
  const [buyTx, setBuyTx] = useState("");

  // Claim
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimErr, setClaimErr] = useState("");
  const [claimTx, setClaimTx] = useState("");

  const { claimable, refresh: refreshBalance } = useConsumerBalance(readonlyProgram, publicKey ?? null);

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
      label: "Kup opakowanie",
      hint: "Wpisz ID opakowania (znajdziesz na etykiecie) i potwierdź transakcję — Twój portfel zostanie powiązany z tym opakowaniem on-chain.",
      done: !!buyTx,
    },
    {
      label: "Oddaj i odbierz kaucję",
      hint: "Wróć z pustą butelką do uczestniczącego sklepu. Kasjer rejestruje zwrot. Następnie kliknij 'Odbierz kaucję' tutaj.",
      done: false,
    },
  ];

  const handlePurchase = async () => {
    if (!program || !publicKey) return;
    setBuyLoading(true); setBuyErr(""); setBuyTx("");
    try {
      const bid = BigInt(buyId);

      // Check SOL balance — need ~0.002 SOL (rent for consumerBalance + fee)
      const balance = await connection.getBalance(publicKey);
      if (balance < 2_000_000) {
        setBuyErr(
          `Za mało SOL na devnet (masz ${(balance / 1e9).toFixed(4)} SOL, potrzebujesz ~0.002). ` +
          `Zdobądź darmowe devnet SOL: faucet.solana.com`
        );
        return;
      }

      // Pre-check container
      try {
        const c = await readonlyProgram.account.container.fetch(pdas.container(bid));
        const status = Object.keys(c.status)[0];
        if (status === "returned") { setBuyErr("To opakowanie zostało już zwrócone."); return; }
        if (status === "settled") { setBuyErr("To opakowanie zostało już rozliczone."); return; }
      } catch {
        setBuyErr(`Opakowanie #${buyId} nie istnieje w systemie.`);
        return;
      }

      const sig = await program.methods
        .purchaseContainer(new BN(bid.toString()))
        .accounts({
          consumer: publicKey,
          container: pdas.container(bid),
          consumerBalance: pdas.consumerBalance(publicKey),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });
      setBuyTx(sig);
      push("purchased", `#${buyId} zakupione`, "consumer");
      await refreshBalance();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes("AlreadyReturned")) setBuyErr("To opakowanie już zostało zwrócone.");
      else if (msg.includes("NotInCirculation")) setBuyErr("To opakowanie nie jest w obiegu.");
      else if (msg.includes("insufficient") || msg.includes("lamports")) {
        setBuyErr("Za mało SOL. Zdobądź darmowe devnet SOL na faucet.solana.com");
      } else setBuyErr(msg.slice(0, 160));
    } finally {
      setBuyLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!program || !publicKey) return;
    setClaimLoading(true); setClaimErr(""); setClaimTx("");
    try {
      const sig = await program.methods
        .claimRefund()
        .accounts({
          consumer: publicKey,
          consumerBalance: pdas.consumerBalance(publicKey),
          config: pdas.config(),
          vault: pdas.vault(),
        })
        .rpc({ skipPreflight: true });
      setClaimTx(sig);
      push("claimed", `kaucja odebrana`, "consumer");
      await refreshBalance();
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      const logs: string[] = e?.logs ?? [];
      const combined = msg + "\n" + logs.join("\n");
      const m = combined.match(/Error Code: (\w+)\./);
      const code = m?.[1];
      if (code === "NothingToClaim" || msg.includes("NothingToClaim")) setClaimErr("Brak kaucji do odbioru.");
      else if (code === "InsufficientVault" || msg.includes("InsufficientVault") || combined.includes("6008"))
        setClaimErr("Skarbiec jest tymczasowo pusty — producent musi zarejestrować więcej opakowań, aby uzupełnić środki.");
      else if (msg.includes("User rejected") || msg.includes("rejected the request")) setClaimErr("Transakcja anulowana.");
      else setClaimErr(msg.split("\n")[0]?.slice(0, 160) || msg.slice(0, 160));
    } finally {
      setClaimLoading(false);
    }
  };

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

          {/* Wallet address card */}
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
                      borderRadius: 8, padding: "8px 14px",
                      fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 12,
                      cursor: "pointer", flexShrink: 0, marginLeft: 16, transition: "background 0.15s",
                    }}
                  >
                    {copied ? "Skopiowano!" : "Kopiuj"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 10, lineHeight: 1.55 }}>
                  Pokaż ten adres kasjerowi przy zwrocie butelki.
                </p>
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
                  Połącz portfel, aby kupować opakowania i odbierać kaucję.
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

          {/* Purchase container */}
          <Card>
            <Label>Kup opakowanie</Label>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
              Wpisz ID opakowania z etykiety, aby powiązać swój portfel z tym opakowaniem on-chain.
            </p>
            <FieldLabel>ID opakowania</FieldLabel>
            <input
              type="number"
              min={1}
              value={buyId}
              onChange={e => { setBuyId(e.target.value); setBuyErr(""); setBuyTx(""); }}
              placeholder="np. 42"
              style={inputStyle}
            />
            {buyErr && <Err msg={buyErr} />}
            {buyTx && <TxLink sig={buyTx} />}
            <div style={{ marginTop: 14 }}>
              <ActionBtn
                onClick={handlePurchase}
                disabled={!program || !publicKey || !buyId || buyLoading}
                loading={buyLoading}
              >
                Kup opakowanie
              </ActionBtn>
            </div>
          </Card>

          {/* Claim refund */}
          <Card>
            <Label>Odbierz kaucję</Label>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
              Po zwrocie opakowania w sklepie Twoja kaucja czeka tutaj do odbioru.
            </p>
            <div style={{
              fontFamily: "IBM Plex Mono, monospace", fontSize: 28, fontWeight: 700,
              color: "var(--ink)", marginBottom: 16,
            }}>
              {claimable === null ? "—" : `${lamportsToDisplay(claimable)} PLN`}
            </div>
            {claimErr && <Err msg={claimErr} />}
            {claimTx && <TxLink sig={claimTx} />}
            <ActionBtn
              onClick={handleClaim}
              disabled={!program || !publicKey || !claimable || claimLoading}
              loading={claimLoading}
            >
              Odbierz kaucję
            </ActionBtn>
          </Card>

          {/* How it works */}
          <Card style={{ gridColumn: "1 / -1", background: "var(--mint-bg)", border: "1px solid var(--mint-ring)" }}>
            <Label>Jak działa zwrot kaucji</Label>
            <ol style={{ paddingLeft: 16, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Producent rejestruje opakowanie on-chain i blokuje kaucję w smart kontrakcie.",
                "Kupujesz napój i klikasz 'Kup opakowanie' — Twój portfel zostaje powiązany z tym ID on-chain.",
                "Wracasz z pustą butelką do sklepu — kasjer skanuje ID i wpisuje Twój adres. Zwrot rejestrowany on-chain natychmiast.",
                "Klikasz 'Odbierz kaucję' — lamporty lądują w Twoim portfelu w ciągu sekund.",
              ].map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.55 }}>{s}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

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
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "22px 24px", boxShadow: "var(--shadow-sm)", ...style,
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
      fontSize: 11, marginTop: 8, fontFamily: "IBM Plex Mono, monospace",
      color: light ? "rgba(255,255,255,0.85)" : "var(--danger)",
    }}>
      {msg}
    </div>
  );
}
