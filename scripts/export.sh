#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  Okkult Circuits — Export"
echo "  Generating Solidity Verifiers"
echo "========================================"
echo ""

# ── Paths ──────────────────────────────────────────────────
ROOT=$(dirname "$(realpath "$0")")/..
KEYS=$ROOT/keys
OUT=$ROOT/../okkult-contracts/contracts/generated

# ── Create output directory ────────────────────────────────
mkdir -p "$OUT"

# ── Export function ────────────────────────────────────────
# Args:
#   $1 = zkey path
#   $2 = output Solidity contract name (e.g. ComplianceVerifier)
export_verifier() {
    ZKEY=$1
    CONTRACT_NAME=$2
    OUT_FILE=$OUT/${CONTRACT_NAME}.sol

    echo "Exporting: $CONTRACT_NAME"

    if [ ! -f "$ZKEY" ]; then
        echo "  Error: zkey not found at $ZKEY"
        echo "  Run ./scripts/setup.sh first."
        exit 1
    fi

    npx snarkjs zkey export solidityverifier \
        "$ZKEY" \
        "$OUT_FILE"

    # Replace default contract name with our naming convention
    sed -i "s/contract Groth16Verifier/contract $CONTRACT_NAME/g" \
        "$OUT_FILE"

    echo "  Exported: $OUT_FILE"
    echo ""
}

# ── Export all verifiers ───────────────────────────────────

export_verifier \
    "$KEYS/compliance/compliance_final.zkey" \
    "ComplianceVerifier"

export_verifier \
    "$KEYS/shield/shield_final.zkey" \
    "ShieldVerifier"

export_verifier \
    "$KEYS/shield/unshield_final.zkey" \
    "UnshieldVerifier"

export_verifier \
    "$KEYS/shield/transfer_final.zkey" \
    "TransferVerifier"

export_verifier \
    "$KEYS/vote/vote_final.zkey" \
    "VoteVerifier"

# ── Summary ───────────────────────────────────────────────
echo "========================================"
echo "  All Solidity verifiers exported."
echo "========================================"
echo ""
echo "Output: okkult-contracts/contracts/generated/"
echo ""
echo "  ComplianceVerifier.sol"
echo "  ShieldVerifier.sol"
echo "  UnshieldVerifier.sol"
echo "  TransferVerifier.sol"
echo "  VoteVerifier.sol"
echo ""
echo "Next: deploy contracts with okkult-contracts"
echo ""
