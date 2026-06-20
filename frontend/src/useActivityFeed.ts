import { useState, useEffect, useCallback } from "react";
import { Program, EventParser } from "@coral-xyz/anchor";

export type FeedRole = "consumer" | "store" | "producer";

export interface FeedEvent {
  id: string;
  type: string;
  label: string;
  ts: number;
  role: FeedRole;
}

function relativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortPk(pk: string): string {
  return pk.slice(0, 4) + "…" + pk.slice(-4);
}

function fmt(lamports: number): string {
  return (lamports / 1_000_000).toFixed(2) + " PLN";
}

const ANCHOR_NAME_TO_TYPE: Record<string, { type: string; role: FeedRole }> = {
  containerRegistered: { type: "registered", role: "producer" },
  containerPurchased:  { type: "purchased",  role: "consumer" },
  containerReturned:   { type: "returned",   role: "store" },
  refundClaimed:       { type: "claimed",    role: "consumer" },
  storeSettled:        { type: "settled",    role: "store" },
  unclaimedSwept:      { type: "swept",      role: "producer" },
};

function anchorEventToFeed(name: string, data: any, ts: number, id: string): FeedEvent | null {
  const meta = ANCHOR_NAME_TO_TYPE[name];
  if (!meta) return null;
  let label = "";
  try {
    switch (name) {
      case "containerRegistered":
        label = `#${data.id} zarejestrowane · ${fmt(data.deposit.toNumber())} · ${shortPk(data.producer.toBase58())}`;
        break;
      case "containerPurchased":
        label = `#${data.id} kupione · ${shortPk(data.consumer.toBase58())}`;
        break;
      case "containerReturned":
        label = `#${data.id} zwrócone · ${fmt(data.deposit.toNumber())} → ${shortPk(data.store.toBase58())}`;
        break;
      case "refundClaimed":
        label = `kaucja odebrana ${fmt(data.amount.toNumber())} → ${shortPk(data.consumer.toBase58())}`;
        break;
      case "storeSettled":
        label = `rozliczono ${fmt(data.amount.toNumber())} → ${shortPk(data.store.toBase58())}`;
        break;
      case "unclaimedSwept":
        label = `#${data.id} windykacja · ${fmt(data.deposit.toNumber())} nieodebrane`;
        break;
      default:
        return null;
    }
  } catch {
    return null;
  }
  return { id, type: meta.type, label, ts, role: meta.role };
}

export function useActivityFeed(program: Program<any> | null) {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  const push = useCallback((type: string, label: string, role: FeedRole) => {
    const ev: FeedEvent = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type, label, ts: Date.now(), role,
    };
    setEvents((prev) => [ev, ...prev].slice(0, 100));
  }, []);

  // Load historical events from chain on mount
  useEffect(() => {
    if (!program) return;
    let cancelled = false;

    const connection = (program.provider as any).connection;
    const parser = new EventParser(program.programId, program.coder);

    (async () => {
      try {
        const sigs = await connection.getSignaturesForAddress(program.programId, { limit: 50 });
        if (cancelled || !sigs.length) return;

        const txs = await Promise.all(
          sigs.map((s: any) =>
            connection.getTransaction(s.signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            }).catch(() => null)
          )
        );
        if (cancelled) return;

        const historical: FeedEvent[] = [];
        for (let i = 0; i < sigs.length; i++) {
          const tx = txs[i];
          if (!tx?.meta?.logMessages) continue;
          const ts = (sigs[i].blockTime ?? 0) * 1000;
          let idx = 0;
          try {
            for (const event of parser.parseLogs(tx.meta.logMessages)) {
              const ev = anchorEventToFeed(event.name, event.data, ts, `${sigs[i].signature}-${idx++}`);
              if (ev) historical.push(ev);
            }
          } catch {}
        }

        if (!cancelled && historical.length) {
          historical.sort((a, b) => b.ts - a.ts);
          setEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const fresh = historical.filter((e) => !existingIds.has(e.id));
            return [...prev, ...fresh].sort((a, b) => b.ts - a.ts).slice(0, 100);
          });
        }
      } catch (err) {
        console.warn("useActivityFeed: failed to load history", err);
      }
    })();

    return () => { cancelled = true; };
  }, [program]);

  // Live WebSocket listener
  useEffect(() => {
    if (!program) return;
    const ids: number[] = [];

    ids.push(
      program.addEventListener("containerRegistered", (e: any) => {
        push("registered", `#${e.id} zarejestrowane · ${fmt(e.deposit.toNumber())} · ${shortPk(e.producer.toBase58())}`, "producer");
      }),
      program.addEventListener("containerPurchased", (e: any) => {
        push("purchased", `#${e.id} kupione · ${shortPk(e.consumer.toBase58())}`, "consumer");
      }),
      program.addEventListener("containerReturned", (e: any) => {
        push("returned", `#${e.id} zwrócone · ${fmt(e.deposit.toNumber())} → ${shortPk(e.store.toBase58())}`, "store");
      }),
      program.addEventListener("refundClaimed", (e: any) => {
        push("claimed", `kaucja odebrana ${fmt(e.amount.toNumber())} → ${shortPk(e.consumer.toBase58())}`, "consumer");
      }),
      program.addEventListener("storeSettled", (e: any) => {
        push("settled", `rozliczono ${fmt(e.amount.toNumber())} → ${shortPk(e.store.toBase58())}`, "store");
      }),
      program.addEventListener("unclaimedSwept", (e: any) => {
        push("swept", `#${e.id} windykacja · ${fmt(e.deposit.toNumber())} nieodebrane`, "producer");
      })
    );

    return () => { ids.forEach((id) => program.removeEventListener(id)); };
  }, [program, push]);

  return { events, relativeTime, push };
}
