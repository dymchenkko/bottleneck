import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ActionBtn } from "../components/ActionBtn";
import { TxLink } from "../components/TxLink";
import { ActivityFeed } from "../components/ActivityFeed";
import { Onboarding } from "../components/Onboarding";
import { pdas } from "../useProgram";
import { useStoreBalance } from "../useRoleBalances";
import { PageContent, Card, Label, FieldLabel, Err, inputStyle } from "./ConsumerPage";
import { type FeedEvent, type FeedRole } from "../useActivityFeed";

interface Props {
  program: any; readonlyProgram: any; onBack: () => void;
  events: FeedEvent[]; relativeTime: (ts: number) => string;
  push: (type: string, label: string, role: FeedRole) => void;
}

function pln(n: number) { return (n / 1_000_000).toFixed(2); }

function getObDismissed() {
  try { return localStorage.getItem("bottleneck_ob_store") === "1"; } catch { return false; }
}

export function StorePage({ program, readonlyProgram, events, relativeTime, push }: Props) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { reimbursable, refresh } = useStoreBalance(readonlyProgram, publicKey ?? null);

  const [retId, setRetId] = useState("");
  const [retLoading, setRetLoading] = useState(false);
  const [retTx, setRetTx] = useState("");
  const [retErr, setRetErr] = useState("");

  const [settleLoading, setSettleLoading] = useState(false);
  const [settleTx, setSettleTx] = useState("");
  const [settleErr, setSettleErr] = useState("");

  const [obDismissed, setObDismissed] = useState(getObDismissed);
  const dismissOnboarding = () => {
    setObDismissed(true);
    try { localStorage.setItem("bottleneck_ob_store", "1"); } catch {}
  };

  const onboardingSteps = [
    {
      label: "Połącz portfel",
      hint: "Kliknij 'Select Wallet' i zaloguj się portfelem swojego sklepu ustawionym na sieć Devnet.",
      done: !!publicKey,
    },
    {
      label: "Przyjmij zwrot",
      hint: "Klient przynosi butelkę? Zeskanuj lub wpisz ID opakowania z etykiety. Kliknij Przyjmij zwrot.",
      done: !!retTx || reimbursable !== null,
    },
    {
      label: "Rozlicz się",
      hint: "Refundacja jest gotowa powyżej — skarbiec prześle PLN bezpośrednio na Twój portfel. Kliknij Rozlicz.",
      done: !!settleTx,
    },
  ];


  const handleReturn = async () => {
    if (!publicKey) { setVisible(true); return; }
    if (!program) return;
    setRetErr(""); setRetTx(""); setRetLoading(true);
    try {
      const bid = BigInt(retId);

      // Fetch container to validate state and get consumer owner
      let ownerPk: PublicKey;
      try {
        const c = await readonlyProgram.account.container.fetch(pdas.container(bid));
        const status = Object.keys(c.status)[0];
        if (status === "returned" || status === "settled") {
          setRetErr("Opakowanie zostało już zwrócone.");
          return;
        }
        if (!c.owner) {
          setRetErr("Klient nie powiązał jeszcze portfela z tym opakowaniem (brak zakupu on-chain).");
          return;
        }
        ownerPk = c.owner as PublicKey;
      } catch {
        setRetErr(`Opakowanie #${retId} nie istnieje w systemie.`);
        return;
      }

      const sig = await program.methods
        .returnContainer(new BN(bid.toString()), ownerPk)
        .accounts({
          store: publicKey,
          container: pdas.container(bid),
          consumerBalance: pdas.consumerBalance(ownerPk),
          collectionPoint: pdas.collectionPoint(publicKey),
          config: pdas.config(),
          systemProgram: SystemProgram.programId,
        })
        .rpc({ skipPreflight: true });
      setRetTx(sig); refresh();
      push("returned", `#${retId} zwrócone`, "store");
    } catch (e: any) { setRetErr(parseErr(e)); }
    finally { setRetLoading(false); }
  };

  const handleSettle = async () => {
    if (!publicKey) { setVisible(true); return; }
    if (!program) return;
    setSettleErr(""); setSettleTx(""); setSettleLoading(true);
    try {
      const sig = await program.methods
        .settleStore()
        .accounts({
          store: publicKey,
          collectionPoint: pdas.collectionPoint(publicKey),
          config: pdas.config(),
          vault: pdas.vault(),
        })
        .rpc({ skipPreflight: true });
      setSettleTx(sig); refresh();
      push("settled", `rozliczono → ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`, "store");
    } catch (e: any) { setSettleErr(parseErr(e)); }
    finally { setSettleLoading(false); }
  };

  const hasSettle = reimbursable !== null && reimbursable > 0;

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 48px" }}>
        {!obDismissed && (
          <Onboarding steps={onboardingSteps} onDismiss={dismissOnboarding} />
        )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Reimbursement balance — hero */}
        <Card style={{ gridColumn: "1 / -1", background: hasSettle ? "var(--amber)" : "var(--surface)" }}>
          <Label light={hasSettle}>Należna refundacja</Label>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
            <div>
              <div style={{
                fontFamily: "IBM Plex Mono, monospace", fontSize: 52, fontWeight: 500, lineHeight: 1,
                color: hasSettle ? "#fff" : reimbursable === null ? "var(--faint)" : "var(--ink)",
              }}>
                {reimbursable === null ? "…" : pln(reimbursable)}
                <span style={{ fontSize: 20, marginLeft: 8, opacity: 0.6 }}>PLN</span>
              </div>
              {!hasSettle && reimbursable !== null && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.55 }}>
                  Brak oczekującej refundacji. Przyjmij zwrot poniżej, aby ją uzyskać.
                </p>
              )}
              {hasSettle && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>
                  Gotowe do rozliczenia — przelew bezpośrednio ze skarbca na Twój portfel.
                </p>
              )}
            </div>
            {hasSettle && (
              <button
                onClick={handleSettle}
                disabled={settleLoading}
                style={{
                  background: "#fff", color: "var(--amber)", border: "none", borderRadius: 10,
                  padding: "12px 24px", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700,
                  fontSize: 14, cursor: settleLoading ? "wait" : "pointer", boxShadow: "var(--shadow)", flexShrink: 0,
                }}
              >
                {settleLoading ? "…" : `Rozlicz ${pln(reimbursable!)} PLN →`}
              </button>
            )}
          </div>
          {settleTx && <TxLink sig={settleTx} />}
          {settleErr && <Err msg={settleErr} light={hasSettle} />}
        </Card>

        {/* Return form */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <Label>Klient oddaje opakowanie?</Label>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 20, lineHeight: 1.55 }}>
            Zeskanuj lub wpisz ID opakowania. Transakcja natychmiast kolejkuje Twoją refundację — bez żadnej księgowości zaplecza.
          </p>
          <div style={{ marginBottom: 14, maxWidth: 240 }}>
            <FieldLabel>ID opakowania</FieldLabel>
            <input type="number" value={retId} onChange={e => setRetId(e.target.value)} placeholder="np. 2" style={inputStyle} />
          </div>
          <ActionBtn onClick={handleReturn} loading={retLoading} disabled={!retId} fullWidth={false}>
            {!publicKey ? "Połącz portfel →" : "Przyjmij zwrot"}
          </ActionBtn>
          {retTx && <TxLink sig={retTx} />}
          {retErr && <Err msg={retErr} />}
        </Card>
      </div>
      </div>
      {/* Store activity log */}
      <div style={{ width: 280, borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityFeed events={events} relativeTime={relativeTime} role="store" />
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
  if (m) {
    const map: Record<string, string> = {
      AlreadyReturned:        "Opakowanie już zostało zwrócone.",
      NotInCirculation:       "Opakowanie nie jest w obiegu.",
      NothingToSettle:        "Brak refundacji do rozliczenia.",
      InsufficientVault:      "Skarbiec ma zbyt niskie saldo.",
      AccountNotInitialized:  "Konto nie zostało zainicjalizowane — sprawdź ID opakowania.",
      Unauthorized:           "Brak uprawnień.",
    };
    return map[m[1]] ?? m[1];
  }
  if (msg.includes("User rejected") || msg.includes("rejected the request")) return "Transakcja anulowana.";
  if (msg.includes("insufficient funds") || msg.includes("insufficient lamports")) return "Niewystarczające saldo SOL — doładuj portfel na devnet.";
  if (msg.includes("does not exist") || msg.includes("Account does not exist"))
    return "Konto nie istnieje — sprawdź ID opakowania.";
  if (msg.toLowerCase().includes("unexpected") || msg.includes("0x1")) {
    return "Upewnij się, że Phantom ma sieć ustawioną na Devnet (Settings → Network → Devnet), a portfel ma wystarczające saldo SOL.";
  }
  const first = msg.split("\n")[0]?.trim();
  return (first && first.length > 3 ? first : msg).slice(0, 160);
}
