# Build

Compiled circuit artifacts are not committed to this repository.

## Generate build output

```bash
./scripts/compile.sh
```

## Build output (generated locally)

```
build/
├── compliance/
│   ├── compliance.r1cs
│   ├── compliance.sym
│   └── compliance_js/
│       ├── compliance.wasm
│       └── witness_calculator.js
├── shield/
│   ├── shield.r1cs
│   ├── shield_js/
│   ├── unshield.r1cs
│   ├── unshield_js/
│   ├── transfer.r1cs
│   └── transfer_js/
└── vote/
    ├── vote.r1cs
    └── vote_js/
```
