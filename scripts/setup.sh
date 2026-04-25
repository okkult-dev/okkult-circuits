#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  Okkult Circuits — Setup"
echo "  Generating Proving Keys"
echo "========================================"
echo ""

# ── Paths ──────────────────────────────────────────────────
ROOT=$(dirname "$(realpath "$0")")/..
BUILD=$ROOT/build
KEYS=$ROOT/keys
PTAU=$ROOT/ptau/powersOfTau28_hez_final_15.ptau

# ── Create key directories ─────────────────────────────────
mkdir -p $KEYS/compliance
mkdir -p $KEYS/shield
mkdir -p $KEYS/vote

# ── Check Powers of Tau exists ─────────────────────────────
if [ ! -f "$PTAU" ]; then
    echo "Error: Powers of Tau not found."
    echo "Run ./scripts/compile.sh first."
    exit 1
fi

# ── Setup function ─────────────────────────────────────────
# Args:
#   $1 = circuit name (e.g. compliance)
#   $2 = r1cs path
#   $3 = output key directory
setup() {
    NAME=$1
    R1CS=$2
    KEYDIR=$3

    echo "--- Setting up: $NAME ---"
    echo ""

    ZKEY_0000=$KEYDIR/${NAME}_0000.zkey
    ZKEY_FINAL=$KEYDIR/${NAME}_final.zkey
    VKEY=$KEYDIR/${NAME}_vkey.json

    # Step 1: Groth16 setup — generate initial zkey
    echo "  [1/3] Groth16 setup..."
    npx snarkjs groth16 setup \
        "$R1CS" \
        "$PTAU" \
        "$ZKEY_0000"
    echo "  Initial zkey generated."
    echo ""

    # Step 2: Contribute randomness to ceremony
    echo "  [2/3] Contributing randomness..."
    echo "okkult-$NAME-$(date +%s)-contribution" | \
    npx snarkjs zkey contribute \
        "$ZKEY_0000" \
        "$ZKEY_FINAL" \
        --name="Okkult $NAME Initial Contribution" \
        -v
    echo "  Final zkey generated."
    echo ""

    # Step 3: Export verification key
    echo "  [3/3] Exporting verification key..."
    npx snarkjs zkey export verificationkey \
        "$ZKEY_FINAL" \
        "$VKEY"
    echo "  Verification key exported."
    echo ""

    # Clean up intermediate zkey
    rm -f "$ZKEY_0000"
    echo "  Setup complete: $NAME"
    echo ""
}

# ── Run setup for all circuits ─────────────────────────────

setup \
    "compliance" \
    "$BUILD/compliance/compliance.r1cs" \
    "$KEYS/compliance"

setup \
    "shield" \
    "$BUILD/shield/shield.r1cs" \
    "$KEYS/shield"

setup \
    "unshield" \
    "$BUILD/shield/unshield.r1cs" \
    "$KEYS/shield"

setup \
    "transfer" \
    "$BUILD/shield/transfer.r1cs" \
    "$KEYS/shield"

setup \
    "vote" \
    "$BUILD/vote/vote.r1cs" \
    "$KEYS/vote"

# ── Summary ───────────────────────────────────────────────
echo "========================================"
echo "  All proving keys generated."
echo "========================================"
echo ""
echo "Output:"
echo "  keys/compliance/compliance_final.zkey"
echo "  keys/compliance/compliance_vkey.json"
echo "  keys/shield/shield_final.zkey"
echo "  keys/shield/shield_vkey.json"
echo "  keys/shield/unshield_final.zkey"
echo "  keys/shield/unshield_vkey.json"
echo "  keys/shield/transfer_final.zkey"
echo "  keys/shield/transfer_vkey.json"
echo "  keys/vote/vote_final.zkey"
echo "  keys/vote/vote_vkey.json"
echo ""
echo "Next: run ./scripts/export.sh"
echo ""
