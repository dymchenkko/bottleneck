#!/usr/bin/env ts-node
import { Command } from "commander";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── helpers ──────────────────────────────────────────────────────────────────

const enc = (s: string) => Buffer.from(s);
const u64le = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

function loadWallet(keypairPath: string): Keypair {
  const raw = fs.readFileSync(keypairPath, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function explorerLink(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function setup(keypairPath: string) {
  const wallet = loadWallet(keypairPath);
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const provider = new AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "..", "target", "idl", "bottleneck.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider) as Program<any>;
  const pid = program.programId;

  const [configPda] = PublicKey.findProgramAddressSync([enc("config")], pid);
  const [vaultPda] = PublicKey.findProgramAddressSync([enc("vault")], pid);

  return { wallet, provider, program, pid, configPda, vaultPda };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const cli = new Command();
cli.name("bottleneck").version("1.0.0");

const walletOpt = ["-k, --keypair <path>", "path to keypair file", `${os.homedir()}/.config/solana/id.json`] as const;

// init ────────────────────────────────────────────────────────────────────────
cli
  .command("init")
  .description("Initialize the Bottleneck system")
  .option(...walletOpt)
  .option("--pet <lamports>", "Pet deposit in lamports", "500000")
  .option("--glass <lamports>", "Glass deposit in lamports", "1000000")
  .option("--threshold <slots>", "Unclaim threshold in slots", "0")
  .action(async (opts) => {
    const { wallet, program, configPda, vaultPda } = setup(opts.keypair);
    const sig = await program.methods
      .initializeSystem(
        new BN(opts.pet),
        new BN(opts.glass),
        new BN(opts.threshold)
      )
      .accounts({
        authority: wallet.publicKey,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log("✓ System initialized");
    console.log("  tx:", explorerLink(sig));
  });

// register ────────────────────────────────────────────────────────────────────
cli
  .command("register <id> <type>")
  .description("Register a container (type: pet|glass)")
  .option(...walletOpt)
  .action(async (id, type, opts) => {
    const { wallet, program, pid, configPda, vaultPda } = setup(opts.keypair);
    const containerType = type.toLowerCase() === "glass" ? { glass: {} } : { pet: {} };
    const [containerPda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(BigInt(id))],
      pid
    );
    const sig = await program.methods
      .registerContainer(new BN(id), containerType)
      .accounts({
        producer: wallet.publicKey,
        container: containerPda,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log(`✓ Container #${id} (${type}) registered`);
    console.log("  tx:", explorerLink(sig));
  });

// purchase ────────────────────────────────────────────────────────────────────
cli
  .command("purchase <id>")
  .description("Purchase a container as consumer")
  .option(...walletOpt)
  .action(async (id, opts) => {
    const { wallet, program, pid } = setup(opts.keypair);
    const [containerPda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(BigInt(id))],
      pid
    );
    const [consumerBalancePda] = PublicKey.findProgramAddressSync(
      [enc("consumer"), wallet.publicKey.toBuffer()],
      pid
    );
    const sig = await program.methods
      .purchaseContainer(new BN(id))
      .accounts({
        consumer: wallet.publicKey,
        container: containerPda,
        consumerBalance: consumerBalancePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log(`✓ Container #${id} purchased`);
    console.log("  tx:", explorerLink(sig));
  });

// return ──────────────────────────────────────────────────────────────────────
cli
  .command("return <id> <ownerPubkey>")
  .description("Submit a container return (store signs, specify consumer pubkey)")
  .option(...walletOpt)
  .action(async (id, ownerPubkey, opts) => {
    const { wallet, program, pid, configPda } = setup(opts.keypair);
    const owner = new PublicKey(ownerPubkey);
    const [containerPda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(BigInt(id))],
      pid
    );
    const [consumerBalancePda] = PublicKey.findProgramAddressSync(
      [enc("consumer"), owner.toBuffer()],
      pid
    );
    const [collectionPointPda] = PublicKey.findProgramAddressSync(
      [enc("store"), wallet.publicKey.toBuffer()],
      pid
    );
    const sig = await program.methods
      .returnContainer(new BN(id), owner)
      .accounts({
        store: wallet.publicKey,
        container: containerPda,
        consumerBalance: consumerBalancePda,
        collectionPoint: collectionPointPda,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log(`✓ Container #${id} returned`);
    console.log("  tx:", explorerLink(sig));
  });

// claim ───────────────────────────────────────────────────────────────────────
cli
  .command("claim")
  .description("Claim consumer refund")
  .option(...walletOpt)
  .action(async (opts) => {
    const { wallet, program, pid, configPda, vaultPda } = setup(opts.keypair);
    const [consumerBalancePda] = PublicKey.findProgramAddressSync(
      [enc("consumer"), wallet.publicKey.toBuffer()],
      pid
    );
    const sig = await program.methods
      .claimRefund()
      .accounts({
        consumer: wallet.publicKey,
        consumerBalance: consumerBalancePda,
        config: configPda,
        vault: vaultPda,
      })
      .signers([wallet])
      .rpc();
    console.log("✓ Refund claimed");
    console.log("  tx:", explorerLink(sig));
  });

// settle ──────────────────────────────────────────────────────────────────────
cli
  .command("settle")
  .description("Settle store reimbursement")
  .option(...walletOpt)
  .action(async (opts) => {
    const { wallet, program, pid, configPda, vaultPda } = setup(opts.keypair);
    const [collectionPointPda] = PublicKey.findProgramAddressSync(
      [enc("store"), wallet.publicKey.toBuffer()],
      pid
    );
    const sig = await program.methods
      .settleStore()
      .accounts({
        store: wallet.publicKey,
        collectionPoint: collectionPointPda,
        config: configPda,
        vault: vaultPda,
      })
      .signers([wallet])
      .rpc();
    console.log("✓ Store settled");
    console.log("  tx:", explorerLink(sig));
  });

// sweep ───────────────────────────────────────────────────────────────────────
cli
  .command("sweep <id>")
  .description("Sweep unclaimed deposit (authority only)")
  .option(...walletOpt)
  .action(async (id, opts) => {
    const { wallet, program, pid, configPda } = setup(opts.keypair);
    const [containerPda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(BigInt(id))],
      pid
    );
    const sig = await program.methods
      .sweepUnclaimed(new BN(id))
      .accounts({
        authority: wallet.publicKey,
        config: configPda,
        container: containerPda,
      })
      .signers([wallet])
      .rpc();
    console.log(`✓ Container #${id} swept`);
    console.log("  tx:", explorerLink(sig));
  });

// status ──────────────────────────────────────────────────────────────────────
cli
  .command("status [id]")
  .description("Show system status, or container status if id given")
  .option(...walletOpt)
  .action(async (id, opts) => {
    const { program, pid, configPda, vaultPda, provider } = setup(opts.keypair);

    const cfg = await program.account.systemConfig.fetch(configPda);
    const vaultBal = await provider.connection.getBalance(vaultPda);
    console.log("\n── System Config ───────────────────────────────");
    console.log(`  Authority:        ${cfg.authority.toBase58()}`);
    console.log(`  Pet deposit:      ${cfg.depositPetLamports.toNumber()} lamports`);
    console.log(`  Glass deposit:    ${cfg.depositGlassLamports.toNumber()} lamports`);
    console.log(`  In circulation:   ${cfg.totalInCirculation.toNumber()}`);
    console.log(`  Total returned:   ${cfg.totalReturned.toNumber()}`);
    console.log(`  Unclaimed total:  ${cfg.totalUnclaimedLamports.toNumber()} lamports`);
    console.log(`  Vault balance:    ${vaultBal} lamports`);

    if (id !== undefined) {
      const [containerPda] = PublicKey.findProgramAddressSync(
        [enc("container"), u64le(BigInt(id))],
        pid
      );
      const c = await program.account.container.fetch(containerPda);
      console.log(`\n── Container #${id} ─────────────────────────────`);
      console.log(`  Type:            ${JSON.stringify(c.containerType)}`);
      console.log(`  Deposit:         ${c.depositLamports.toNumber()} lamports`);
      console.log(`  Status:          ${JSON.stringify(c.status)}`);
      console.log(`  Owner:           ${c.owner?.toBase58() ?? "none"}`);
      console.log(`  Producer:        ${c.producer.toBase58()}`);
      console.log(`  Registered slot: ${c.registeredSlot.toNumber()}`);
    }
  });

cli.parse(process.argv);
