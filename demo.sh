#!/usr/bin/env bash
# Bottleneck demo.sh — runs the full happy path on devnet and prints Explorer links.
# Requires: Solana CLI, ts-node in cli/node_modules, funded keypairs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${SCRIPT_DIR}/cli/node_modules/.bin/ts-node --project ${SCRIPT_DIR}/cli/tsconfig.json ${SCRIPT_DIR}/cli/index.ts"

# ── Key files (override via env) ──────────────────────────────────────────────
AUTHORITY_KEY="${AUTHORITY_KEY:-${HOME}/.config/solana/id.json}"
PRODUCER_KEY="${PRODUCER_KEY:-${SCRIPT_DIR}/.demo-keys/producer.json}"
CONSUMER_KEY="${CONSUMER_KEY:-${SCRIPT_DIR}/.demo-keys/consumer.json}"
STORE_KEY="${STORE_KEY:-${SCRIPT_DIR}/.demo-keys/store.json}"

CONTAINER_ID=2

# ── Generate demo keypairs if they don't exist ────────────────────────────────
mkdir -p "${SCRIPT_DIR}/.demo-keys"
for kf in "$PRODUCER_KEY" "$CONSUMER_KEY" "$STORE_KEY"; do
  if [[ ! -f "$kf" ]]; then
    solana-keygen new --no-bip39-passphrase --silent -o "$kf"
    echo "Generated $kf"
  fi
done

echo ""
echo "=== Funding demo accounts (devnet) ==="
for kf in "$AUTHORITY_KEY" "$PRODUCER_KEY" "$CONSUMER_KEY" "$STORE_KEY"; do
  addr=$(solana address -k "$kf")
  bal=$(solana balance "$addr" --url devnet 2>/dev/null | awk '{print $1}' || echo "0")
  if (( $(echo "$bal < 0.5" | bc -l) )); then
    echo "Airdropping to ${addr}..."
    solana airdrop 2 "$addr" --url devnet || echo "  (airdrop may be rate-limited, continuing)"
  else
    echo "${addr}: ${bal} SOL (already funded)"
  fi
done

CONSUMER_PUBKEY=$(solana address -k "$CONSUMER_KEY")

echo ""
echo "=== Bottleneck Demo — Devnet Happy Path ==="
echo ""

# 1. Initialize system (idempotent — re-init fails if already done)
echo "Step 1: Initialize system"
${CLI} init -k "$AUTHORITY_KEY" || echo "  (already initialized, skipping)"
echo ""

# 2. Register container
echo "Step 2: Register container #${CONTAINER_ID} (Pet)"
${CLI} register "$CONTAINER_ID" pet -k "$PRODUCER_KEY" || echo "  (already registered, skipping)"
echo ""

# 3. Purchase container
echo "Step 3: Purchase container #${CONTAINER_ID} (consumer links wallet)"
${CLI} purchase "$CONTAINER_ID" -k "$CONSUMER_KEY"
echo ""

# 4. Return container
echo "Step 4: Return container #${CONTAINER_ID} (store submits, owner=${CONSUMER_PUBKEY})"
${CLI} return "$CONTAINER_ID" "$CONSUMER_PUBKEY" -k "$STORE_KEY"
echo ""

# 5. Claim refund
echo "Step 5: Consumer claims refund"
${CLI} claim -k "$CONSUMER_KEY"
echo ""

# 6. Settle store
echo "Step 6: Store settles reimbursement"
${CLI} settle -k "$STORE_KEY"
echo ""

# 7. Status
echo "Step 7: System status"
${CLI} status "$CONTAINER_ID" -k "$AUTHORITY_KEY"
echo ""

echo "=== Demo complete — all tx links printed above ==="
