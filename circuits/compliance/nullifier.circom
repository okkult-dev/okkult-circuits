pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    NullifierHasher

    Computes the nullifier for a compliance proof.

    nullifier = Poseidon(address, secret)

    Properties:
    - Deterministic: same inputs always produce same nullifier
    - One-way: cannot reverse to get address or secret
    - Unique per address + secret pair
    - Stored on NullifierRegistry.sol to prevent proof reuse

    Private inputs:
    - address : wallet address as field element
    - secret  : random 32-byte value stored locally by user

    Output:
    - nullifier : Poseidon(address, secret)
*/
template NullifierHasher() {
    signal private input address;
    signal private input secret;
    signal output nullifier;

    component h = Poseidon(2);
    h.inputs[0] <== address;
    h.inputs[1] <== secret;
    nullifier <== h.out;
}

component main = NullifierHasher();
