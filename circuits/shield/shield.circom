pragma circom 2.0.0;

include "commitment.circom";

/*
    Shield

    Proves that a UTXO commitment was formed correctly
    from the given private inputs — without revealing
    those inputs on-chain.

    Used when a user deposits ERC-20 tokens into
    OkkultShield. The commitment is inserted into the
    UTXO Merkle tree on-chain.

    Private inputs:
    - amount              : token amount being shielded
    - token               : ERC-20 address as field element
    - secret              : random secret stored locally
    - owner               : wallet address of owner

    Public inputs:
    - commitment          : expected UTXO commitment hash
    - complianceNullifier : nullifier from compliance proof
                            (proves user passed compliance check)

    Constraints:
    1. commitment === Poseidon(amount, token, secret, owner)
       Proves commitment was formed correctly without
       revealing amount, token, secret, or owner.
*/
template Shield() {

    // ── Private inputs ────────────────────────────────────
    signal private input amount;
    signal private input token;
    signal private input secret;
    signal private input owner;

    // ── Public inputs ─────────────────────────────────────
    signal input commitment;
    signal input complianceNullifier;

    // ── Constraint: Commitment must be valid ──────────────
    component c = Commitment();
    c.amount <== amount;
    c.token  <== token;
    c.secret <== secret;
    c.owner  <== owner;

    // The on-chain commitment must match the computed one
    commitment === c.commitment;
}

component main {
    public [commitment, complianceNullifier]
} = Shield();
