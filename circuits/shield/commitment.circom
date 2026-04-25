pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    Commitment

    Computes the UTXO commitment hash for OkkultShield.

    commitment = Poseidon(amount, token, secret, owner)

    The commitment is:
    - Stored on-chain in the UTXO Merkle tree
    - The only on-chain record of the shielded UTXO
    - Hides amount, token, and owner from all observers
    - Can only be spent by the owner who knows the secret

    Private inputs:
    - amount : token amount being shielded
    - token  : ERC-20 token address as field element
    - secret : random 32-byte value stored locally by user
    - owner  : wallet address of the UTXO owner

    Output:
    - commitment : Poseidon(amount, token, secret, owner)
*/
template Commitment() {
    signal private input amount;
    signal private input token;
    signal private input secret;
    signal private input owner;
    signal output commitment;

    component h = Poseidon(4);
    h.inputs[0] <== amount;
    h.inputs[1] <== token;
    h.inputs[2] <== secret;
    h.inputs[3] <== owner;
    commitment <== h.out;
}
