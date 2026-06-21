import { useState, useEffect } from "react";
import { QRScanner } from "../components/QRScanner";
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
  events: FeedEvent[]; feedLoading?: boolean; relativeTime: (ts: number) => string;
  push: (type: string, label: string, role: FeedRole) => void;
}

function pln(n: number) { return (n / 1_000_000).toFixed(2); }

function getObDismissed() {
  try { return localStorage.getItem("bottleneck_ob_store") === "1"; } catch { return false; }
}

export function StorePage({ program, readonlyProgram, events, feedLoading, relativeTime, push }: Props) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { reimbursable, refresh } = useStoreBalance(readonlyProgram, publicKey ?? null);

  const [retId, setRetId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [retLoading, setRetLoading] = useState(false);
  const [retTx, setRetTx] = useState("");
  const [retErr, setRetErr] = useState("");

  // Auto-fetched container info when ID is entered
  const [containerOwner, setContainerOwner] = useState<PublicKey | null | undefined>(undefined); // undefined=not fetched, null=no owner
  const [manualOwner, setManualOwner] = useState("");
  const [idLookupErr, setIdLookupErr] = useState("");

  const [settleLoading, setSettleLoading] = useState(false);
  const [settleTx, setSettleTx] = useState("");
  const [settleErr, setSettleErr] = useState("");

  const [obDismissed, setObDismissed] = useState(getObDismissed);
  const dismissOnboarding = () => {
    setObDismissed(true);
    try { localStorage.setItem("bottleneck_ob_store", "1"); } catch {}
  };

  // Auto-fetch container owner when ID is typed
  useEffect(() => {
    setContainerOwner(undefined);
    setIdLookupErr("");
    if (!retId || !readonlyProgram) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const bid = BigInt(retId);
        const c = await readonlyProgram.account.container.fetch(pdas.container(bid));
        if (cancelled) return;
        const status = Object.keys(c.status)[0];
        if (status === "returned" || status === "settled") {
          setIdLookupErr("Opakowanie zostało już zwrócone.");
          setContainerOwner(undefined);
        } else {
          setContainerOwner(c.owner ?? null);
        }
      } catch {
        if (!cancelled) setIdLookupErr(`Opakowanie #${retId} nie istnieje w systemie.`);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [retId, readonlyProgram]);

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

      // Resolve owner: from on-chain or manual input
      let ownerPk: PublicKey;
      if (containerOwner) {
        ownerPk = containerOwner;
      } else if (manualOwner.trim()) {
        try { ownerPk = new PublicKey(manualOwner.trim()); }
        catch { setRetErr("Nieprawidłowy adres portfela klienta."); return; }
      } else {
        setRetErr("Wpisz adres portfela klienta poniżej.");
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

        {/* Who must connect — info box */}
        <Card style={{ gridColumn: "1 / -1", background: "var(--mint-bg)", border: "1px solid var(--mint-ring)" }}>
          <Label>Kto podłącza portfel?</Label>
          <p style={{ fontSize: 12, color: "var(--ink)", marginTop: 10, lineHeight: 1.6 }}>
            <strong>Sklep</strong> podłącza swój portfel (widoczny w prawym górnym rogu). Klient <strong>nie musi</strong> być podłączony podczas zwrotu — wystarczy ID opakowania lub adres portfela klienta.
          </p>
        </Card>

        {/* Return form */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <Label>Klient oddaje opakowanie?</Label>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 20, lineHeight: 1.55 }}>
            Wpisz ID opakowania. System automatycznie sprawdzi, który portfel klienta jest powiązany.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <FieldLabel>ID opakowania</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={retId}
                  onChange={e => { setRetId(e.target.value); setRetErr(""); setRetTx(""); setManualOwner(""); }}
                  placeholder="np. 13"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => setShowScanner(true)}
                  title="Skanuj QR z butelki"
                  style={{
                    background: "var(--mint)", color: "#fff", border: "none",
                    borderRadius: 8, padding: "0 14px", cursor: "pointer",
                    fontSize: 18, flexShrink: 0,
                  }}
                >
                  ⬛
                </button>
              </div>
              {showScanner && (
                <QRScanner
                  onScan={id => { setRetId(id); setRetErr(""); setRetTx(""); setManualOwner(""); setShowScanner(false); }}
                  onClose={() => setShowScanner(false)}
                />
              )}
              {idLookupErr && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 6, fontFamily: "IBM Plex Mono, monospace" }}>{idLookupErr}</div>}
            </div>
            <div>
              <FieldLabel>Portfel klienta</FieldLabel>
              {containerOwner ? (
                <div style={{
                  ...inputStyle, display: "flex", alignItems: "center", gap: 8,
                  background: "var(--mint-bg)", border: "1px solid var(--mint-ring)",
                }}>
                  <span style={{ color: "var(--mint)", fontSize: 11 }}>✓</span>
                  <span style={{ fontSize: 11, color: "var(--ink)", wordBreak: "break-all" }}>
                    {containerOwner.toBase58().slice(0, 8)}…{containerOwner.toBase58().slice(-6)}
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={manualOwner}
                  onChange={e => { setManualOwner(e.target.value); setRetErr(""); }}
                  placeholder="Wpisz adres portfela klienta"
                  style={{ ...inputStyle, fontSize: 11 }}
                />
              )}
              {containerOwner === null && !manualOwner && (
                <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 6, lineHeight: 1.5 }}>
                  Klient nie powiązał portfela on-chain. Podaj jego adres ręcznie (klient pokazuje QR z poziomu Klient → adres portfela).
                </div>
              )}
            </div>
          </div>
          <ActionBtn
            onClick={handleReturn}
            loading={retLoading}
            disabled={!retId || !!idLookupErr || (containerOwner === null && !manualOwner.trim())}
            fullWidth={false}
          >
            {!publicKey ? "Połącz portfel →" : "Przyjmij zwrot"}
          </ActionBtn>
          {retTx && <TxLink sig={retTx} />}
          {retErr && <Err msg={retErr} />}
        </Card>
      </div>
      </div>
      {/* Store activity log */}
      <div style={{ width: 280, borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityFeed events={events} loading={feedLoading} relativeTime={relativeTime} role="store" />
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
