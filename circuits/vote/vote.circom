pragma circom 2.0.0;

include "../compliance/merkle.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    PrivateVote

    Proves an eligible voter cast a valid encrypted vote
    in an Okkult governance poll.

    Proves:
    1. Voter is in the eligible voter Merkle tree
    2. Vote choice is binary (only 0 or 1 allowed)
    3. Nullifier is correctly derived (prevents double voting)
    4. Encrypted vote is consistent with actual choice

    Without revealing:
    - Who the voter is
    - What they voted for

    Private inputs:
    - voterAddress         : voter wallet address
    - voterSecret          : random secret stored locally
    - voteChoice           : 0 (no) or 1 (yes)
    - voteNonce            : random nonce for vote encryption
    - pathElements[levels] : Merkle path siblings
    - pathIndices[levels]  : 0 = left, 1 = right

    Public inputs:
    - pollId        : unique poll ID (prevents cross-poll reuse)
    - voterRoot     : Merkle root of eligible voters
    - encryptedVote : Poseidon(voteChoice, voteNonce)
    - nullifier     : Poseidon(voterAddress, voterSecret, pollId)

    Constraints:
    1. voteChoice * (voteChoice - 1) === 0  (binary check)
    2. MerkleProof(voterAddress, voterRoot, path)  (eligibility)
    3. nullifier === Poseidon(voterAddress, voterSecret, pollId)
    4. encryptedVote === Poseidon(voteChoice, voteNonce)
*/
template PrivateVote(levels) {

    // ── Private inputs ────────────────────────────────────
    signal private input voterAddress;
    signal private input voterSecret;
    signal private input voteChoice;
    signal private input voteNonce;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────
    signal input pollId;
    signal input voterRoot;
    signal input encryptedVote;
    signal input nullifier;

    // ── Constraint 1: Vote choice must be binary ──────────
    // Only 0 (no) or 1 (yes) are valid vote choices
    // voteChoice * (voteChoice - 1) === 0
    // satisfies only when voteChoice == 0 or voteChoice == 1
    voteChoice * (voteChoice - 1) === 0;

    // ── Constraint 2: Voter is in eligible set ────────────
    // Proves voter is authorized for this poll
    // without revealing which voter they are
    component merkle = MerkleProof(levels);
    merkle.leaf <== voterAddress;
    merkle.root <== voterRoot;

    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }

    // ── Constraint 3: Nullifier is valid ──────────────────
    // nullifier = Poseidon(voterAddress, voterSecret, pollId)
    // Unique per voter per poll — prevents voting twice
    // Published on-chain to mark voter as having voted
    component nullHasher = Poseidon(3);
    nullHasher.inputs[0] <== voterAddress;
    nullHasher.inputs[1] <== voterSecret;
    nullHasher.inputs[2] <== pollId;
    nullifier === nullHasher.out;

    // ── Constraint 4: Encrypted vote is consistent ────────
    // encryptedVote = Poseidon(voteChoice, voteNonce)
    // Binds the encrypted vote to the actual choice
    // Prevents coordinator from substituting votes
    component voteHasher = Poseidon(2);
    voteHasher.inputs[0] <== voteChoice;
    voteHasher.inputs[1] <== voteNonce;
    encryptedVote === voteHasher.out;
}

component main {
    public [pollId, voterRoot, encryptedVote, nullifier]
} = PrivateVote(20);
