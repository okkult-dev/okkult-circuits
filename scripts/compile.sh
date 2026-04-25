#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  Okkult Circuits — Compile"
echo "========================================"
echo ""

# ── Paths ──────────────────────────────────────────────────
ROOT=$(dirname "$(realpath "$0")")/..
BUILD=$ROOT/build
PTAU=$ROOT/ptau/powersOfTau28_hez_final_15.ptau
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau"

# ── Create build directories ───────────────────────────────
mkdir -p $BUILD/compliance
mkdir -p $BUILD/shield
mkdir -p $BUILD/vote
mkdir -p $ROOT/ptau

# ── Download Powers of Tau if not present ─────────────────
if [ ! -f "$PTAU" ]; then
    echo "Downloading Powers of Tau..."
    echo "Source: $PTAU_URL"
    echo ""
    curl -L "$PTAU_URL" -o "$PTAU" --progress-bar
    echo ""
    echo "Powers of Tau downloaded."
    echo ""
fi

# ── Compile function ───────────────────────────────────────
compile() {
    CIRCUIT=$1
    OUT=$2
    echo "Compiling: $CIRCUIT"
    circom "$ROOT/circuits/$CIRCUIT" \
        --r1cs \
        --wasm \
        --sym \
        -o "$OUT" \
        -l "$ROOT/node_modules"
    echo "Done: $CIRCUIT"
    echo ""
}

# ── Compliance circuits ────────────────────────────────────
echo "--- Compliance Circuits ---"
echo ""
compile "compliance/compliance.circom" "$BUILD/compliance"

# ── Shield circuits ────────────────────────────────────────
echo "--- Shield Circuits ---"
echo ""
compile "shield/shield.circom"    "$BUILD/shield"
compile "shield/unshield.circom"  "$BUILD/shield"
compile "shield/transfer.circom"  "$BUILD/shield"

# ── Vote circuits ──────────────────────────────────────────
echo "--- Vote Circuits ---"
echo ""
compile "vote/vote.circom"  "$BUILD/vote"

# ── Summary ───────────────────────────────────────────────
echo "========================================"
echo "  All circuits compiled successfully."
echo "========================================"
echo ""
echo "Output:"
echo "  build/compliance/compliance.r1cs"
echo "  build/compliance/compliance_js/"
echo "  build/shield/shield.r1cs"
echo "  build/shield/shield_js/"
echo "  build/shield/unshield.r1cs"
echo "  build/shield/unshield_js/"
echo "  build/shield/transfer.r1cs"
echo "  build/shield/transfer_js/"
echo "  build/vote/vote.r1cs"
echo "  build/vote/vote_js/"
echo ""
echo "Next: run ./scripts/setup.sh"
echo ""
