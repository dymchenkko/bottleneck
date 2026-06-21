# Bottleneck

On-chain bottle deposit return system on Solana. Built for the Superteam bounty.

**Live:** [frontend-gilt-two-18.vercel.app](https://frontend-gilt-two-18.vercel.app) · Phantom/Solflare on Devnet  
**Program:** [`CmcEwPFFefG2BpzPe2q4eUCAVijdxLf18ppDyLWYRCti`](https://explorer.solana.com/address/CmcEwPFFefG2BpzPe2q4eUCAVijdxLf18ppDyLWYRCti?cluster=devnet)

---

## The problem

Poland's kaucja (bottle deposit) law exists — but in practice: you return the bottle, you get a paper voucher valid only in that store, only that day. Nobody gets cash back. 4 billion bottles a year, no accountability.

## How it works

```
Producer  →  register_container   locks deposit in vault
Consumer  →  purchase_container   links wallet to bottle
Store     →  return_container     credits consumer + store instantly
Consumer  →  claim_refund         lamports arrive in seconds
Store     →  settle_store         reimbursement arrives in seconds
```

No central operator. No vouchers. Anyone can verify the math on-chain.

---

## On-chain flow (Devnet)

| # | Instruction | Tx |
|---|---|---|
| 1 | `register_container` | [view](https://explorer.solana.com/tx/5CKCZ5FEfWX1X5MDkeFgb7NToaRwtg1Qbnftuzb8TU4okH8uD65zUTF69DoZsW6q3GBkhNLin961VHT8WCnaQkuf?cluster=devnet) |
| 2 | `purchase_container` | [view](https://explorer.solana.com/tx/4akQNfUNFZKgvRoFTRB8rSnoVTEr3ciMEGUQ1c54qJEkte3NiEQ9K6hdBp2dkncun5BiUTeutUD6gqX1hZTn41a5?cluster=devnet) |
| 3 | `return_container` | [view](https://explorer.solana.com/tx/2Gg9EUYJasQNHGVS9pD5ZQc73nrWiXxuugF1N1y5rp3qLWsgxX8YtG2Zu3MBRdqKzkvvUqQYXyt1CbzHVFC6pjEi?cluster=devnet) |
| 4 | `claim_refund` | [view](https://explorer.solana.com/tx/2FuxPiaJt8Ry8izQKvjQfsU7qnk1YdjxhKdipq9LVZiWd6BQU4tv56J2H6fokqEeg2EVAKtivM2hGotAXNeYWfSf?cluster=devnet) |
| 5 | `settle_store` | [view](https://explorer.solana.com/tx/4oUL1gYKKpZQnLnKgoGyqWQxWH5jnamRP1rgvRA1GwauG56viEseKmiQDQws4NmvtJL1a6u3wbWkhKRyCretjYEQ?cluster=devnet) |

---

## Architecture

**PDAs:**

| Account | Seeds | Holds |
|---|---|---|
| `SystemConfig` | `["config"]` | authority, deposit amount, counters |
| `Vault` | `["vault"]` | all locked SOL |
| `Container` | `["container", id_u64_le]` | per-bottle state + owner |
| `ConsumerBalance` | `["consumer", wallet]` | claimable lamports per consumer |
| `CollectionPoint` | `["store", wallet]` | reimbursable lamports per store |

Vault payouts use direct lamport mutation (`try_borrow_mut_lamports`) — no System CPI out of PDA. All math is `checked_add`/`checked_sub`. Every instruction emits an `emit!()` event consumed by the frontend live feed.

---

## Run locally

```bash
# Tests
anchor test

# Frontend (Devnet)
cd frontend && npm install && npm run dev

# CLI demo
cd cli && npm install && bash demo.sh
```
