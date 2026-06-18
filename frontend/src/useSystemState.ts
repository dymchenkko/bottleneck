import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Program } from "@coral-xyz/anchor";
import { pdas } from "./useProgram";

export interface SystemState {
  authority: string;
  depositPet: number;
  depositGlass: number;
  totalInCirculation: number;
  totalReturned: number;
  totalUnclaimedLamports: number;
  vaultBalance: number;
  loading: boolean;
}

const EMPTY: SystemState = {
  authority: "",
  depositPet: 0,
  depositGlass: 0,
  totalInCirculation: 0,
  totalReturned: 0,
  totalUnclaimedLamports: 0,
  vaultBalance: 0,
  loading: true,
};

export function useSystemState(readonlyProgram: Program<any> | null) {
  const { connection } = useConnection();
  const [state, setState] = useState<SystemState>(EMPTY);

  const refresh = useCallback(async () => {
    if (!readonlyProgram) return;
    try {
      const configPda = pdas.config();
      const vaultPda = pdas.vault();
      const [cfg, vaultBal] = await Promise.all([
        (readonlyProgram.account as any)["systemConfig"].fetch(configPda).catch(() => null),
        connection.getBalance(vaultPda).catch(() => 0),
      ]);
      if (!cfg) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      setState({
        authority: (cfg as any).authority.toBase58(),
        depositPet: (cfg as any).depositPetLamports.toNumber(),
        depositGlass: (cfg as any).depositGlassLamports.toNumber(),
        totalInCirculation: (cfg as any).totalInCirculation.toNumber(),
        totalReturned: (cfg as any).totalReturned.toNumber(),
        totalUnclaimedLamports: (cfg as any).totalUnclaimedLamports.toNumber(),
        vaultBalance: vaultBal,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [readonlyProgram, connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, refresh };
}
