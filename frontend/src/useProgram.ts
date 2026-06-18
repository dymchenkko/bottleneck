import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import idl from "./idl.json";

export const PROGRAM_ID = new PublicKey(
  "CmcEwPFFefG2BpzPe2q4eUCAVijdxLf18ppDyLWYRCti"
);

const enc = (s: string) => Buffer.from(s);
const u64le = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

export const pdas = {
  config: () =>
    PublicKey.findProgramAddressSync([enc("config")], PROGRAM_ID)[0],
  vault: () =>
    PublicKey.findProgramAddressSync([enc("vault")], PROGRAM_ID)[0],
  container: (id: number | bigint) =>
    PublicKey.findProgramAddressSync(
      [enc("container"), u64le(id)],
      PROGRAM_ID
    )[0],
  collectionPoint: (pk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [enc("store"), pk.toBuffer()],
      PROGRAM_ID
    )[0],
  consumerBalance: (pk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [enc("consumer"), pk.toBuffer()],
      PROGRAM_ID
    )[0],
};

export function lamportsToDisplay(lamports: number): string {
  return (lamports / 1_000_000).toFixed(2);
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      },
      { commitment: "confirmed" }
    );
  }, [connection, wallet.publicKey, wallet.signTransaction]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as any, provider);
  }, [provider]);

  const readonlyProvider = useMemo(() => {
    const dummyWallet = {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    return new AnchorProvider(connection, dummyWallet, {
      commitment: "confirmed",
    });
  }, [connection]);

  const readonlyProgram = useMemo(
    () => new Program(idl as any, readonlyProvider),
    [readonlyProvider]
  );

  return { program, readonlyProgram, provider, wallet };
}

export { BN };
