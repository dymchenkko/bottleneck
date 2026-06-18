import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { pdas } from "./useProgram";

export function useStoreBalance(readonlyProgram: any, wallet: PublicKey | null) {
  const [reimbursable, setReimbursable] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!readonlyProgram || !wallet) { setReimbursable(null); return; }
    try {
      const pda = pdas.collectionPoint(wallet);
      const acc = await (readonlyProgram.account as any)["collectionPoint"].fetch(pda);
      setReimbursable(acc.reimbursableLamports.toNumber());
    } catch {
      setReimbursable(0);
    }
  }, [readonlyProgram, wallet]);

  useEffect(() => { refresh(); }, [refresh]);
  return { reimbursable, refresh };
}
