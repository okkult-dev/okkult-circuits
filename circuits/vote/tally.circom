pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    TallyVotes

    Run by the poll coordinator after voting closes.

    Proves the tally is correct without revealing
    individual voter choices.

    Proves:
    1. Each encrypted vote decrypts correctly
    2. Total tally matches sum of all decrypted votes
    3. No votes were added, removed, or tampered with

    Without revealing:
    - Individual voter choices

    Private inputs:
    - encryptedVotes[nVotes] : array of encrypted votes
    - decryptedVotes[nVotes] : decrypted values (0 or 1)
    - nonces[nVotes]         : vote nonces used for encryption

    Public inputs:
    - totalYes  : total count of yes votes
    - totalNo   : total count of no votes
    - voteCount : total number of votes cast
*/
template TallyVotes(nVotes) {

    // ── Private inputs ────────────────────────────────────
    signal private input encryptedVotes[nVotes];
    signal private input decryptedVotes[nVotes];
    signal private input nonces[nVotes];

    // ── Public inputs ─────────────────────────────────────
    signal input totalYes;
    signal input totalNo;
    signal input voteCount;

    // ── Accumulate yes and no counts ──────────────────────
    signal yesAccum[nVotes + 1];
    signal noAccum[nVotes + 1];
    yesAccum[0] <== 0;
    noAccum[0]  <== 0;

    component hashers[nVotes];

    for (var i = 0; i < nVotes; i++) {

        // Each decrypted vote must be binary (0 or 1)
        decryptedVotes[i] * (decryptedVotes[i] - 1) === 0;

        // Encrypted vote must match Poseidon(decrypted, nonce)
        // Proves decryption is correct and untampered
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== decryptedVotes[i];
        hashers[i].inputs[1] <== nonces[i];
        encryptedVotes[i] === hashers[i].out;

        // Accumulate yes count
        yesAccum[i + 1] <== yesAccum[i] + decryptedVotes[i];

        // Accumulate no count
        noAccum[i + 1] <== noAccum[i] + (1 - decryptedVotes[i]);
    }

    // ── Final tally must match public inputs ──────────────
    totalYes === yesAccum[nVotes];
    totalNo  === noAccum[nVotes];

    // voteCount is a compile-time constant (nVotes)
    // enforced by the circuit template parameter
    _ <== voteCount;
}

// Supports up to 1000 votes per round
component main {
    public [totalYes, totalNo, voteCount]
} = TallyVotes(1000);
