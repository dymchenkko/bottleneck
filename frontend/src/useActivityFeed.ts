import { useState, useEffect } from "react";
import { Program } from "@coral-xyz/anchor";

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

export function useActivityFeed(program: Program<any> | null) {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  const push = (type: string, label: string, role: FeedRole) => {
    const ev: FeedEvent = { id: `${type}-${Date.now()}-${Math.random()}`, type, label, ts: Date.now(), role };
    setEvents((prev) => [ev, ...prev].slice(0, 100));
  };

  // WebSocket listener — best-effort; devnet may miss events
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
  }, [program]); // eslint-disable-line react-hooks/exhaustive-deps

  return { events, relativeTime, push };
}
