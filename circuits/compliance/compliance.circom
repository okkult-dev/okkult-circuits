pragma circom 2.0.0;

include "merkle.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    ComplianceProof

    Main ZK compliance proof circuit for Okkult Protocol.

    Proves that a wallet address EXISTS in the compliance
    Merkle tree (set of clean, non-sanctioned addresses)
    WITHOUT revealing:
    - The wallet address itself
    - The secret
    - Any balance or transaction history

    Private inputs (only the user knows these):
    - address      : wallet address as field element
    - secret       : random 32-byte value stored locally
    - pathElements : sibling nodes along Merkle path
    - pathIndices  : 0 = left, 1 = right at each level

    Public inputs (visible on-chain):
    - root      : current Merkle root of compliance set
    - nullifier : Poseidon(address, secret)

    Constraints enforced:
    1. nullifier === Poseidon(address, secret)
       Proves ownership of the address without revealing it.
       The nullifier is stored on-chain to prevent reuse.

    2. MerkleProof(address, root, pathElements, pathIndices)
       Proves address is a member of the clean compliance set.
       The address itself is never exposed as a public signal.
*/
template ComplianceProof(levels) {

    // ── Private inputs ────────────────────────────────────
    signal private input address;
    signal private input secret;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────
    signal input root;
    signal input nullifier;

    // ── Constraint 1: Verify nullifier ───────────────────
    // nullifier = Poseidon(address, secret)
    // Proves the user knows the address behind this proof
    // without revealing the address on-chain
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== address;
    nullifierHasher.inputs[1] <== secret;
    nullifier === nullifierHasher.out;

    // ── Constraint 2: Verify Merkle membership ────────────
    // Proves address is in the compliance set
    // without revealing which address it is
    component merkle = MerkleProof(levels);
    merkle.leaf <== address;
    merkle.root <== root;

    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
}

// Tree depth 20 supports 2^20 = 1,048,576 addresses
// Public signals: root (index 0), nullifier (index 1)
component main {
    public [root, nullifier]
} = ComplianceProof(20);
