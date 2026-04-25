# Keys

Proving and verification keys are not committed to this repository.

## Generate keys locally

```bash
# Step 1: Compile circuits
./scripts/compile.sh

# Step 2: Generate proving keys
./scripts/setup.sh
```
```
## Key files (generated locally)
keys/
├── compliance/
│   ├── compliance_final.zkey
│   └── compliance_vkey.json
├── shield/
│   ├── shield_final.zkey
│   ├── shield_vkey.json
│   ├── unshield_final.zkey
│   ├── unshield_vkey.json
│   ├── transfer_final.zkey
│   └── transfer_vkey.json
└── vote/
├── vote_final.zkey
└── vote_vkey.json
```
## Trust

Proving keys are derived from the Hermez Powers of Tau
ceremony — a community MPC with thousands of participants.
No new trusted setup is required.

Hermez ceremony: hermez.io/cryptography/2021/01/26/Hermez-zkEVM.html
