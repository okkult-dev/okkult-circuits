pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

/*
    MerkleProof

    Verifies that a leaf exists in a Poseidon Merkle tree
    by recomputing the root from the leaf and the Merkle path.

    At each level i:
    - If pathIndices[i] == 0: current node is LEFT
      hash = Poseidon(levelHash, pathElements[i])
    - If pathIndices[i] == 1: current node is RIGHT
      hash = Poseidon(pathElements[i], levelHash)

    The final computed root must equal the public input root.

    Inputs:
    - leaf              : the leaf to prove membership of
    - root              : the expected Merkle root (public)
    - pathElements[levels] : sibling nodes along the path
    - pathIndices[levels]  : 0 = left, 1 = right at each level
*/
template MerkleProof(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Track hash at each level — starts at leaf
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    component hashers[levels];
    component mux[levels];

    for (var i = 0; i < levels; i++) {

        // Ensure pathIndices[i] is binary (0 or 1)
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        // Select left and right inputs based on path index
        // If pathIndices[i] == 0: left = levelHash, right = sibling
        // If pathIndices[i] == 1: left = sibling, right = levelHash
        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s       <== pathIndices[i];

        // Hash the selected pair with Poseidon(2)
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    // Computed root must match the public input root
    root === levelHashes[levels];
}
