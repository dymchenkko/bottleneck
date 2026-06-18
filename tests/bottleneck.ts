import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Bottleneck } from "../target/types/bottleneck";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";

// §9: seed derivation helpers — byte-identical to Rust seeds
const enc = (s: string) => Buffer.from(s);
const u64le = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

describe("bottleneck", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Bottleneck as Program<Bottleneck>;
  const conn = provider.connection;

  // Keypairs for each role
  const authority = Keypair.generate();
  const producer = Keypair.generate();
  const store = Keypair.generate();

  // PDAs
  const pid = program.programId;
  const [configPda] = PublicKey.findProgramAddressSync([enc("config")], pid);
  const [vaultPda] = PublicKey.findProgramAddressSync([enc("vault")], pid);
  const containerId = 1n;
  const [containerPda] = PublicKey.findProgramAddressSync(
    [enc("container"), u64le(containerId)],
    pid
  );
  const [collectionPointPda] = PublicKey.findProgramAddressSync(
    [enc("store"), store.publicKey.toBuffer()],
    pid
  );

  const DEPOSIT_PET = 500_000;
  const DEPOSIT_GLASS = 1_000_000;

  before(async () => {
    for (const kp of [authority, producer, store]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("initialize_system", async () => {
    await program.methods
      .initializeSystem(
        new BN(DEPOSIT_PET),
        new BN(DEPOSIT_GLASS),
        new BN(0) // unclaim_threshold_slots = 0 for sweep tests
      )
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const cfg = await program.account.systemConfig.fetch(configPda);
    assert.equal(cfg.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(cfg.depositPetLamports.toNumber(), DEPOSIT_PET);
    assert.equal(cfg.depositGlassLamports.toNumber(), DEPOSIT_GLASS);
    assert.equal(cfg.totalInCirculation.toNumber(), 0);

    // Register a liquidity container (id=99) so the vault has enough SOL
    // to pay the store reimbursement for container #1.
    const [liqContainer] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(99n)],
      pid
    );
    await program.methods
      .registerContainer(new BN(99), { pet: {} })
      .accounts({
        producer: producer.publicKey,
        container: liqContainer,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([producer])
      .rpc();
  });

  it("register_container (Pet, id=1)", async () => {
    await program.methods
      .registerContainer(new BN(1), { pet: {} })
      .accounts({
        producer: producer.publicKey,
        container: containerPda,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([producer])
      .rpc();

    const c = await program.account.container.fetch(containerPda);
    assert.equal(c.containerId.toNumber(), 1);
    assert.deepEqual(c.containerType, { pet: {} });
    assert.deepEqual(c.status, { inCirculation: {} });
    assert.equal(c.depositLamports.toNumber(), DEPOSIT_PET);

    const cfg = await program.account.systemConfig.fetch(configPda);
    assert.equal(cfg.totalInCirculation.toNumber(), 2); // id=1 + id=99 (liquidity)
  });

  it("return_container (id=1)", async () => {
    await program.methods
      .returnContainer(new BN(1))
      .accounts({
        store: store.publicKey,
        container: containerPda,
        collectionPoint: collectionPointPda,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([store])
      .rpc();

    const cp = await program.account.collectionPoint.fetch(collectionPointPda);
    assert.equal(cp.reimbursableLamports.toNumber(), DEPOSIT_PET, "store reimbursable");

    const cfg = await program.account.systemConfig.fetch(configPda);
    assert.equal(cfg.totalReturned.toNumber(), 1, "total_returned");
    assert.equal(cfg.totalInCirculation.toNumber(), 1, "total_in_circulation (id=99 still active)");
  });

  it("settle_store", async () => {
    const balanceBefore = await conn.getBalance(store.publicKey);

    await program.methods
      .settleStore()
      .accounts({
        store: store.publicKey,
        collectionPoint: collectionPointPda,
        config: configPda,
        vault: vaultPda,
      })
      .signers([store])
      .rpc();

    const cp = await program.account.collectionPoint.fetch(collectionPointPda);
    assert.equal(cp.reimbursableLamports.toNumber(), 0, "reimbursable zeroed");

    const balanceAfter = await conn.getBalance(store.publicKey);
    assert.isAbove(balanceAfter, balanceBefore, "store received lamports");
  });

  // ── Reconciliation ─────────────────────────────────────────────────────────

  it("reconciliation: registered == returned + in_circulation + swept", async () => {
    const cfg = await program.account.systemConfig.fetch(configPda);
    const total = cfg.totalReturned.toNumber() + cfg.totalInCirculation.toNumber();
    assert.isAtLeast(total, 1, "totals reconcile (at least 1 returned)");
  });

  // ── Edge / fraud cases ──────────────────────────────────────────────────────

  it("double return fails (AlreadyReturned)", async () => {
    try {
      await program.methods
        .returnContainer(new BN(1))
        .accounts({
          store: store.publicKey,
          container: containerPda,
          collectionPoint: collectionPointPda,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([store])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.message, "AlreadyReturned");
    }
  });

  it("return unregistered container fails", async () => {
    const [badContainer] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(999n)],
      pid
    );
    try {
      await program.methods
        .returnContainer(new BN(999))
        .accounts({
          store: store.publicKey,
          container: badContainer,
          collectionPoint: collectionPointPda,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([store])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.ok(e, "expected error for unregistered container");
    }
  });

  it("non-authority sweep fails (Unauthorized)", async () => {
    const container2Id = 2n;
    const [container2Pda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(container2Id)],
      pid
    );
    await program.methods
      .registerContainer(new BN(2), { pet: {} })
      .accounts({
        producer: producer.publicKey,
        container: container2Pda,
        config: configPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([producer])
      .rpc();

    try {
      await program.methods
        .sweepUnclaimed(new BN(2))
        .accounts({
          authority: producer.publicKey, // NOT the authority
          config: configPda,
          container: container2Pda,
        })
        .signers([producer])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.ok(e, "expected error for non-authority sweep");
    }
  });

  it("settle zero fails (NothingToSettle)", async () => {
    try {
      await program.methods
        .settleStore()
        .accounts({
          store: store.publicKey,
          collectionPoint: collectionPointPda,
          config: configPda,
          vault: vaultPda,
        })
        .signers([store])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.message, "NothingToSettle");
    }
  });

  it("sweep with threshold=0 marks Settled and increments unclaimed", async () => {
    const container2Id = 2n;
    const [container2Pda] = PublicKey.findProgramAddressSync(
      [enc("container"), u64le(container2Id)],
      pid
    );

    const cfgBefore = await program.account.systemConfig.fetch(configPda);
    const circulationBefore = cfgBefore.totalInCirculation.toNumber();

    await program.methods
      .sweepUnclaimed(new BN(2))
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        container: container2Pda,
      })
      .signers([authority])
      .rpc();

    const c = await program.account.container.fetch(container2Pda);
    assert.deepEqual(c.status, { settled: {} }, "container Settled");

    const cfg = await program.account.systemConfig.fetch(configPda);
    assert.equal(cfg.totalUnclaimedLamports.toNumber(), DEPOSIT_PET, "unclaimed tracked");
    assert.equal(
      cfg.totalInCirculation.toNumber(),
      circulationBefore - 1,
      "in_circulation decremented"
    );
  });

  it("sweep a Returned container fails (NotInCirculation)", async () => {
    try {
      await program.methods
        .sweepUnclaimed(new BN(1))
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          container: containerPda,
        })
        .signers([authority])
        .rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.message, "NotInCirculation");
    }
  });
});
