pragma circom 2.0.0;

include "commitment.circom";
include "../compliance/merkle.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    PrivateTransfer

    Proves a private transfer between two 0zk addresses
    inside OkkultShield.

    Proves:
    1. Input UTXO is valid and exists in the Merkle tree
    2. Two output UTXOs are correctly formed
    3. Conservation: inAmount === outAmount1 + outAmount2
       No tokens can be created or destroyed

    Without revealing:
    - Sender or recipient identity
    - Amounts transferred
    - Link between input and output UTXOs

    Private inputs:
    Input UTXO:
    - inAmount, inToken, inSecret, inOwner
    - pathElements[levels], pathIndices[levels]

    Output UTXO 1 (to recipient):
    - outAmount1, outSecret1, outOwner1

    Output UTXO 2 (change back to sender):
    - outAmount2, outSecret2, outOwner2

    Public inputs:
    - root           : UTXO tree Merkle root
    - inNullifier    : Poseidon(inCommitment, inSecret)
    - outCommitment1 : commitment of output UTXO 1
    - outCommitment2 : commitment of output UTXO 2

    Constraints:
    1. Compute inCommitment from input UTXO private data
    2. Verify inCommitment exists in Merkle tree
    3. inNullifier === Poseidon(inCommitment, inSecret)
    4. outCommitment1 === Poseidon(outAmount1, inToken, outSecret1, outOwner1)
    5. outCommitment2 === Poseidon(outAmount2, inToken, outSecret2, outOwner2)
    6. inAmount === outAmount1 + outAmount2 (conservation law)
*/
template PrivateTransfer(levels) {

    // ── Input UTXO (private) ──────────────────────────────
    signal private input inAmount;
    signal private input inToken;
    signal private input inSecret;
    signal private input inOwner;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    // ── Output UTXO 1 — to recipient (private) ────────────
    signal private input outAmount1;
    signal private input outSecret1;
    signal private input outOwner1;

    // ── Output UTXO 2 — change to sender (private) ────────
    signal private input outAmount2;
    signal private input outSecret2;
    signal private input outOwner2;

    // ── Public inputs ─────────────────────────────────────
    signal input root;
    signal input inNullifier;
    signal input outCommitment1;
    signal input outCommitment2;

    // ── Step 1: Compute input commitment ─────────────────
    component inCommit = Commitment();
    inCommit.amount <== inAmount;
    inCommit.token  <== inToken;
    inCommit.secret <== inSecret;
    inCommit.owner  <== inOwner;

    // ── Step 2: Verify input UTXO in Merkle tree ─────────
    component merkle = MerkleProof(levels);
    merkle.leaf <== inCommit.commitment;
    merkle.root <== root;

    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }

    // ── Step 3: Verify input nullifier ───────────────────
    // Marks input UTXO as spent — prevents double spend
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== inCommit.commitment;
    nullHasher.inputs[1] <== inSecret;
    inNullifier === nullHasher.out;

    // ── Step 4: Verify output commitment 1 ───────────────
    component outCommit1 = Commitment();
    outCommit1.amount <== outAmount1;
    outCommit1.token  <== inToken;
    outCommit1.secret <== outSecret1;
    outCommit1.owner  <== outOwner1;
    outCommitment1 === outCommit1.commitment;

    // ── Step 5: Verify output commitment 2 ───────────────
    component outCommit2 = Commitment();
    outCommit2.amount <== outAmount2;
    outCommit2.token  <== inToken;
    outCommit2.secret <== outSecret2;
    outCommit2.owner  <== outOwner2;
    outCommitment2 === outCommit2.commitment;

    // ── Step 6: Conservation law ──────────────────────────
    // Input amount must equal sum of both outputs
    // Prevents token creation or destruction
    inAmount === outAmount1 + outAmount2;
}

component main {
    public [root, inNullifier, outCommitment1, outCommitment2]
} = PrivateTransfer(20);
