# okkult-circuits

```bash
$ cat description.txt
> ZK circuits for Okkult Protocol.
> Written in Circom. Groth16 proof system.
```

---

## Circuits

```bash
$ ls circuits/
> compliance/
>   compliance.circom   → Main ZK compliance proof
>   merkle.circom       → Merkle path verifier
>   nullifier.circom    → Nullifier derivation
>   hasher.circom       → Poseidon hash wrapper
>
> shield/
>   shield.circom       → Shield ERC-20 into pool
>   unshield.circom     → Withdraw from pool
>   transfer.circom     → Private transfer between 0zk addresses
>   commitment.circom   → UTXO commitment helper
>
> vote/
>   vote.circom         → Encrypted private vote
>   tally.circom        → Tally result verification
```

---

## Setup

```bash
# Install Circom
cargo install circom

# Install dependencies
npm install

# Compile all circuits
./scripts/compile.sh

# Generate proving keys
./scripts/setup.sh

# Export Solidity verifiers to okkult-contracts
./scripts/export.sh
```

---

## Test

```bash
npm test
```

---

## Part of Okkult Protocol

```bash
$ cat ecosystem.txt
> okkult-proof      Core ZK compliance circuit
> okkult-sdk        TypeScript SDK
> okkult-contracts  Smart contracts
> okkult-circuits   ← you are here
> okkult-app        Frontend
> okkult-subgraph   The Graph indexer
> okkult-docs       Documentation
```

---

## License

```bash
$ cat license.txt
> MIT — okkult.io · @Okkult_
```
