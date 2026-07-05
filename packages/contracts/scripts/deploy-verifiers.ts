// Deploy SalaryRangeVerifier + EmploymentVerifier to Polygon.
//
// Prerequisites (run once before deploying):
//   1. Install circom: npm i -g @circom/circom
//   2. Install snarkjs: npm i -g snarkjs
//   3. Download Powers of Tau (phase 1 ceremony):
//      wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau
//   4. Compile + setup each circuit:
//      ./scripts/build-circuits.sh
//      This generates the final .zkey files and exports updated Verifier.sol contracts.
//   5. Replace the IC placeholder values in SalaryRangeVerifier.sol + EmploymentVerifier.sol
//      with the values from the exported verificationKey.json files.
//
// Then run this script:
//   pnpm --filter @attesta/contracts deploy:amoy   (testnet)
//   pnpm --filter @attesta/contracts deploy:polygon  (mainnet)

import hre from 'hardhat'

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log(`Deploying with: ${deployer.address}`)

  // ── SalaryRangeVerifier ───────────────────────────────────────────────
  const SalaryVerifier = await hre.ethers.getContractFactory('SalaryRangeVerifier')
  const salaryVerifier = await SalaryVerifier.deploy()
  await salaryVerifier.waitForDeployment()
  const salaryAddr = await salaryVerifier.getAddress()
  console.log(`SalaryRangeVerifier deployed to: ${salaryAddr}`)

  // ── EmploymentVerifier ────────────────────────────────────────────────
  const EmpVerifier = await hre.ethers.getContractFactory('EmploymentVerifier')
  const empVerifier = await EmpVerifier.deploy()
  await empVerifier.waitForDeployment()
  const empAddr = await empVerifier.getAddress()
  console.log(`EmploymentVerifier deployed to: ${empAddr}`)

  console.log('\nAdd to .env:')
  console.log(`SALARY_RANGE_VERIFIER_ADDRESS="${salaryAddr}"`)
  console.log(`EMPLOYMENT_VERIFIER_ADDRESS="${empAddr}"`)
}

main().catch(err => { console.error(err); process.exit(1) })
