pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

/*
    Hasher2
    
    Wraps Poseidon(2) for use across compliance circuits.
    Used wherever two field elements need to be hashed together.
    
    Inputs:
    - left  : first field element
    - right : second field element
    
    Output:
    - hash : Poseidon(left, right)
*/
template Hasher2() {
    signal input left;
    signal input right;
    signal output hash;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    hash <== h.out;
}

/*
    Hasher4
    
    Wraps Poseidon(4) for use in UTXO commitment computation.
    Used to hash: Poseidon(amount, token, secret, owner)
    
    Inputs:
    - in[4] : array of four field elements
    
    Output:
    - hash : Poseidon(in[0], in[1], in[2], in[3])
*/
template Hasher4() {
    signal input in[4];
    signal output hash;

    component h = Poseidon(4);
    h.inputs[0] <== in[0];
    h.inputs[1] <== in[1];
    h.inputs[2] <== in[2];
    h.inputs[3] <== in[3];
    hash <== h.out;
}
