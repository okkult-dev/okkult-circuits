pragma circom 2.0.0;

include "commitment.circom";
include "../compliance/merkle.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    Unshield

    Proves a user owns a UTXO and authorizes withdrawal.

    Proves:
    1. User owns a UTXO in the UTXO Merkle tree
    2. Nullifier is correctly derived (prevents double-spend)
    3. Amount matches the UTXO contents

    Without revealing:
    - Owner identity
    - Full transaction history
    - Link between this withdrawal and the original deposit

    Private inputs:
    - amount, token, secret, owner : UTXO contents
    - pathElements[levels]         : Merkle path siblings
    - pathIndices[levels]          : 0 = left, 1 = right

    Public inputs:
    - root      : current UTXO tree Merkle root
    - nullifier : Poseidon(commitment, secret)
    - recipient : destination address (only public output)

    Constraints:
    1. Compute commitment = Poseidon(amount, token, secret, owner)
    2. Verify commitment exists in UTXO tree via Merkle proof
    3. nullifier === Poseidon(commitment, secret)
*/
template Unshield(levels) {

    // ── Private inputs ────────────────────────────────────
    signal private input amount;
    signal private input token;
    signal private input secret;
    signal private input owner;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────
    signal input root;
    signal input nullifier;
    signal input recipient;

    // ── Step 1: Compute UTXO commitment ──────────────────
    component c = Commitment();
    c.amount <== amount;
    c.token  <== token;
    c.secret <== secret;
    c.owner  <== owner;

    // ── Step 2: Verify commitment in UTXO Merkle tree ────
    // Proves the UTXO was previously shielded
    component merkle = MerkleProof(levels);
    merkle.leaf <== c.commitment;
    merkle.root <== root;

    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }

    // ── Step 3: Verify nullifier ──────────────────────────
    // nullifier = Poseidon(commitment, secret)
    // Published on-chain to mark this UTXO as spent
    // Prevents the same UTXO from being withdrawn twice
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== c.commitment;
    nullHasher.inputs[1] <== secret;
    nullifier === nullHasher.out;
}

component main {
    public [root, nullifier, recipient]
} = Unshield(20);
