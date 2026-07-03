# ATTESTA ZK Circuits

Groth16 circuits for privacy-preserving disclosures. Compiled with Circom 2.0.

## Circuits

### `salaryRange.circom`
Proves `salary >= minSalary && salary <= maxSalary` without revealing exact salary.

**Public inputs:** `minSalary`, `maxSalary`, `valid` (must = 1)
**Private input:** `salary`

### `employmentDuration.circom`
Proves `months >= minMonths` without revealing exact tenure.

**Public inputs:** `minMonths`, `valid` (must = 1)
**Private input:** `months`

## Build Instructions

### Prerequisites (install once)
```bash
npm install -g circom
npm install -g snarkjs

# Powers of Tau — download once (~200MB, phase 1 ceremony)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau \
     -O circuits/powersOfTau28_hez_final_14.ptau
```

### Compile circuits
```bash
cd packages/contracts
bash scripts/build-circuits.sh
```

This will:
1. Compile `.circom` → `.r1cs` + `.wasm` + `.sym`
2. Run Groth16 trusted setup (phase 2)
3. Export `_final.zkey` + `verification_key.json`
4. **Overwrite** `SalaryRangeVerifier.sol` + `EmploymentVerifier.sol` with real IC constants
5. Copy WASM + zkey → `apps/web/public/circuits/` for client-side proving

### After building
```bash
# Deploy updated contracts
pnpm --filter @attesta/contracts deploy:amoy   # testnet
pnpm --filter @attesta/contracts deploy:polygon # mainnet
```

## Client-side proving (browser)
```typescript
import { groth16 } from 'snarkjs'

// Salary range proof
const { proof, publicSignals } = await groth16.fullProve(
  { salary: '150000', minSalary: '100000', maxSalary: '200000' },
  '/circuits/salaryRange/salaryRange.wasm',
  '/circuits/salaryRange/salaryRange_final.zkey'
)

// Send proof to /api/zk/[id]/prove
```

## Security notes
- Proofs generated **client-side only** — server never sees raw salary/months
- Trusted setup: production should use multi-party ceremony (>= 3 contributors)
- Current `build-circuits.sh` uses single contributor — safe for testnet, not mainnet
- For mainnet: run a proper ceremony or use a universal setup (PLONK/FFLONK)
