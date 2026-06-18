import { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { FlowMeter } from "../components/FlowMeter";
import { ContainerLookup } from "../components/ContainerLookup";
import { ActivityFeed } from "../components/ActivityFeed";
import { ActionBtn } from "../components/ActionBtn";
import { TxLink } from "../components/TxLink";
import { pdas } from "../useProgram";
import { type SystemState } from "../useSystemState";
import { type FeedEvent, type FeedRole } from "../useActivityFeed";
import { PageContent, Card, Label } from "./ConsumerPage";

interface Props {
  readonlyProgram: any; program: any; state: SystemState;
  events: FeedEvent[]; relativeTime: (ts: number) => string; onBack: () => void;
  push: (type: string, label: string, role: FeedRole) => void;
}

export function DashboardPage({ readonlyProgram, program, state, events, relativeTime, push }: Props) {
  const { publicKey } = useWallet();
  const isAuthority = publicKey && state.authority
    ? publicKey.toBase58() === state.authority : false;

  const [sweepId, setSweepId] = useState("");
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepTx, setSweepTx] = useState("");
  const [sweepErr, setSweepErr] = useState("");

  const historyLoaded = useRef(false);
  useEffect(() => {
    if (!readonlyProgram || historyLoaded.current) return;
    historyLoaded.current = true;
    readonlyProgram.account.container.all().then((containers: any[]) => {
      containers
        .sort((a: any, b: any) => a.account.id.toNumber() - b.account.id.toNumber())
        .forEach((c: any) => {
          const id = c.account.id.toNumber();
          const status = Object.keys(c.account.status)[0];
          const deposit = c.account.deposit?.toNumber() ?? 0;
          const pln = (deposit / 1_000_000).toFixed(2);
          push("registered", `#${id} zarejestrowane · ${pln} PLN`, "producer");
          if (status === "returned" || status === "settled") {
            push("returned", `#${id} zwrócone`, "store");
          }
          if (status === "settled") {
            push("settled", `#${id} rozliczono`, "store");
          }
        });
    }).catch(() => {});
  }, [readonlyProgram]);

  const handleSweep = async () => {
    if (!publicKey || !program) return;
    setSweepErr(""); setSweepTx(""); setSweepLoading(true);
    try {
      const bid = BigInt(sweepId);
      const sig = await program.methods.sweepUnclaimed(new BN(bid.toString()))
        .accounts({ authority: publicKey, config: pdas.config(), container: pdas.container(bid) })
        .rpc();
      setSweepTx(sig);
    } catch (e: any) { setSweepErr((e?.message ?? String(e)).split("\n")[0].slice(0, 100)); }
    finally { setSweepLoading(false); }
  };

  const vaultPln = Math.max(0, (state.vaultBalance - 890880) / 1_000_000).toFixed(2);

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Main stats */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>

          {/* Vault hero */}
          <Card style={{ gridColumn: "1 / -1", background: "var(--ink)" }}>
            <Label light>Skarbiec — łączna kaucja zablokowana on-chain</Label>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 }}>
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 48, fontWeight: 500, color: "#fff", lineHeight: 1 }}>
                  {vaultPln}
                  <span style={{ fontSize: 20, marginLeft: 8, color: "rgba(255,255,255,0.5)" }}>PLN</span>
                </div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                  {state.vaultBalance.toLocaleString()} lamports
                  {isAuthority && <span style={{ marginLeft: 10, color: "var(--amber-mid)" }}>· jesteś operatorem</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { label: "W obiegu", value: String(state.totalInCirculation), color: "var(--mint-mid)" },
                  { label: "Zwrócono", value: String(state.totalReturned), color: "rgba(255,255,255,0.8)" },
                  { label: "Nieodebrane (PLN)", value: (state.totalUnclaimedLamports / 1_000_000).toFixed(2), color: "var(--amber-mid)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 500, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Flow meter */}
          <Card style={{ gridColumn: "1 / -1" }}>
            <FlowMeter state={state} />
          </Card>

          {/* Config */}
          {state.authority && (() => {
            const items = [
              { label: "Kaucja PET", value: (state.depositPet / 1_000_000).toFixed(2) + " PLN" },
              { label: "Kaucja szklana", value: (state.depositGlass / 1_000_000).toFixed(2) + " PLN" },
              { label: "Operator", value: state.authority.slice(0, 10) + "…" },
            ];
            return items.map(({ label, value }) => (
              <Card key={label}>
                <Label>{label}</Label>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 18, color: "var(--ink)", marginTop: 8 }}>{value}</div>
              </Card>
            ));
          })()}
        </div>

        {/* Container lookup */}
        <ContainerLookup readonlyProgram={readonlyProgram} />

        {/* Sweep */}
        {isAuthority && (
          <div style={{ marginTop: 20 }}>
            <Card style={{ borderColor: "var(--amber-ring)", background: "var(--amber-bg)" }}>
              <Label>Operator — windykuj nieodebrane</Label>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, marginBottom: 14, lineHeight: 1.5 }}>
                Odzyskaj kaucje z opakowań, które nie zostały zwrócone po upływie progu.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="number" value={sweepId} onChange={e => setSweepId(e.target.value)}
                  placeholder="ID opakowania"
                  style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, color: "var(--ink)", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, padding: "9px 12px", outline: "none" }}
                />
                <ActionBtn onClick={handleSweep} loading={sweepLoading} disabled={!sweepId} variant="danger">Windykuj</ActionBtn>
              </div>
              {sweepTx && <TxLink sig={sweepTx} />}
              {sweepErr && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8, fontFamily: "IBM Plex Mono, monospace" }}>{sweepErr}</div>}
            </Card>
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div style={{ width: 300, borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ActivityFeed events={events} relativeTime={relativeTime} />
      </div>
    </div>
  );
}
