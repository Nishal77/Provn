/**
 * deploy-all.ts — Unified ATTESTA contract deployment script.
 *
 * Deploys all contracts in dependency order:
 *   1. MockREPToken (testnet only — skip on mainnet if REP already deployed)
 *   2. OpenRepDAO (governance — depends on REP token)
 *   3. DIDRegistry (identity anchor)
 *   4. SalaryRangeVerifier (ZK — requires circuits compiled first)
 *   5. EmploymentVerifier  (ZK — requires circuits compiled first)
 *   6. BountyRegistry (TrustChain — Phase 11)
 *
 * ReferralEscrow is deployed per-referral by BountyRegistry, not here.
 *
 * Prerequisites:
 *   1. Fund deployer wallet with MATIC (Amoy faucet: https://faucet.polygon.technology/)
 *   2. Set env vars: DEPLOYER_PRIVATE_KEY, POLYGONSCAN_API_KEY
 *   3. ZK circuits compiled: pnpm circuits:build (see scripts/build-circuits.sh)
 *      → updates SalaryRangeVerifier.sol + EmploymentVerifier.sol with real IC values
 *
 * Run:
 *   pnpm --filter @attesta/contracts deploy:amoy    # testnet
 *   pnpm --filter @attesta/contracts deploy:polygon # mainnet
 */

import hre from 'hardhat'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

interface DeployedContracts {
  network:             string
  chainId:             number
  deployer:            string
  deployedAt:          string
  MockREPToken?:       string
  OpenRepDAO?:         string
  DIDRegistry:         string
  SalaryRangeVerifier: string
  EmploymentVerifier:  string
  BountyRegistry:      string
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const network = await hre.ethers.provider.getNetwork()
  const chainId = Number(network.chainId)
  const networkName = hre.network.name

  const isMainnet  = chainId === 137
  const isTestnet  = chainId === 80002
  const isLocalnet = chainId === 31337

  console.log('\n══════════════════════════════════════════════════')
  console.log('  ATTESTA — Contract Deployment')
  console.log('══════════════════════════════════════════════════')
  console.log(`  Network:  ${networkName} (chainId ${chainId})`)
  console.log(`  Deployer: ${deployer.address}`)

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log(`  Balance:  ${hre.ethers.formatEther(balance)} MATIC`)

  if (balance === 0n && !isLocalnet) {
    console.error('\n  ERROR: Deployer has 0 MATIC. Fund it first.')
    if (isTestnet) console.error('  Amoy faucet: https://faucet.polygon.technology/')
    process.exit(1)
  }

  const deployed: Partial<DeployedContracts> = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  }

  // ── 1. MockREPToken (testnet + local only) ──────────────────────────────
  let repTokenAddress: string

  if (isMainnet) {
    repTokenAddress = process.env.REP_TOKEN_ADDRESS ?? ''
    if (!repTokenAddress) {
      console.error('\n  ERROR: REP_TOKEN_ADDRESS required for mainnet deploy.')
      process.exit(1)
    }
    console.log(`\n[1/6] REP Token (existing): ${repTokenAddress}`)
  } else {
    console.log('\n[1/6] Deploying MockREPToken...')
    const MockREPToken = await hre.ethers.getContractFactory('MockREPToken')
    const repToken = await MockREPToken.deploy()
    await repToken.waitForDeployment()
    repTokenAddress = await repToken.getAddress()
    deployed.MockREPToken = repTokenAddress
    console.log(`      MockREPToken: ${repTokenAddress}`)
  }

  // ── 2. OpenRepDAO ──────────────────────────────────────────────────────
  console.log('\n[2/6] Deploying OpenRepDAO...')
  const OpenRepDAO = await hre.ethers.getContractFactory('OpenRepDAO')
  const dao = await OpenRepDAO.deploy(repTokenAddress)
  await dao.waitForDeployment()
  const daoAddress = await dao.getAddress()
  deployed.OpenRepDAO = daoAddress
  console.log(`      OpenRepDAO: ${daoAddress}`)

  // ── 3. DIDRegistry ─────────────────────────────────────────────────────
  console.log('\n[3/6] Deploying DIDRegistry...')
  const DIDRegistry = await hre.ethers.getContractFactory('DIDRegistry')
  const registry = await DIDRegistry.deploy(deployer.address)
  await registry.waitForDeployment()
  const registryAddress = await registry.getAddress()
  deployed.DIDRegistry = registryAddress
  console.log(`      DIDRegistry: ${registryAddress}`)

  // ── 4. SalaryRangeVerifier ─────────────────────────────────────────────
  console.log('\n[4/6] Deploying SalaryRangeVerifier...')
  const SalaryVerifier = await hre.ethers.getContractFactory('SalaryRangeVerifier')
  const salaryVerifier = await SalaryVerifier.deploy()
  await salaryVerifier.waitForDeployment()
  const salaryAddress = await salaryVerifier.getAddress()
  deployed.SalaryRangeVerifier = salaryAddress
  console.log(`      SalaryRangeVerifier: ${salaryAddress}`)

  // ── 5. EmploymentVerifier ──────────────────────────────────────────────
  console.log('\n[5/6] Deploying EmploymentVerifier...')
  const EmpVerifier = await hre.ethers.getContractFactory('EmploymentVerifier')
  const empVerifier = await EmpVerifier.deploy()
  await empVerifier.waitForDeployment()
  const empAddress = await empVerifier.getAddress()
  deployed.EmploymentVerifier = empAddress
  console.log(`      EmploymentVerifier: ${empAddress}`)

  // ── 6. BountyRegistry ─────────────────────────────────────────────────
  console.log('\n[6/6] Deploying BountyRegistry...')
  const BountyRegistry = await hre.ethers.getContractFactory('BountyRegistry')
  const bountyRegistry = await BountyRegistry.deploy()
  await bountyRegistry.waitForDeployment()
  const bountyAddress = await bountyRegistry.getAddress()
  deployed.BountyRegistry = bountyAddress
  console.log(`      BountyRegistry: ${bountyAddress}`)

  // ── Write deployment manifest ───────────────────────────────────────────
  mkdirSync('./deployments', { recursive: true })
  const outPath = join('./deployments', `${networkName}.json`)
  writeFileSync(outPath, JSON.stringify(deployed, null, 2))
  console.log(`\n  Deployment manifest → ${outPath}`)

  // ── Polygonscan verification ────────────────────────────────────────────
  if (process.env.POLYGONSCAN_API_KEY && (isMainnet || isTestnet)) {
    console.log('\n  Waiting 5 confirmations before Polygonscan verification...')
    await new Promise(r => setTimeout(r, 30_000))

    const contracts = [
      { name: 'DIDRegistry',         address: registryAddress,  args: [deployer.address] },
      { name: 'SalaryRangeVerifier', address: salaryAddress,    args: [] },
      { name: 'EmploymentVerifier',  address: empAddress,       args: [] },
      { name: 'BountyRegistry',      address: bountyAddress,    args: [] },
      { name: 'OpenRepDAO',          address: daoAddress,       args: [repTokenAddress] },
      ...(deployed.MockREPToken ? [{ name: 'MockREPToken', address: repTokenAddress, args: [] }] : []),
    ]

    for (const c of contracts) {
      try {
        await hre.run('verify:verify', { address: c.address, constructorArguments: c.args })
        console.log(`  ✓ ${c.name} verified on Polygonscan`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Already Verified')) {
          console.log(`  ✓ ${c.name} already verified`)
        } else {
          console.warn(`  ✗ ${c.name} verification failed: ${msg}`)
        }
      }
    }
  }

  // ── .env instructions ───────────────────────────────────────────────────
  const prefix = isMainnet ? 'POLYGON' : isTestnet ? 'AMOY' : 'LOCAL'
  const polygonscanBase = isMainnet
    ? 'https://polygonscan.com/address'
    : isTestnet
    ? 'https://amoy.polygonscan.com/address'
    : 'local'

  console.log('\n══════════════════════════════════════════════════')
  console.log('  Add to .env:')
  console.log('══════════════════════════════════════════════════')
  if (deployed.MockREPToken) console.log(`  REP_TOKEN_ADDRESS="${repTokenAddress}"`)
  console.log(`  ${prefix}_DAO_ADDRESS="${daoAddress}"`)
  console.log(`  ${prefix}_DID_REGISTRY_ADDRESS="${registryAddress}"`)
  console.log(`  DID_REGISTRY_ADDRESS="${registryAddress}"`)
  console.log(`  SALARY_RANGE_VERIFIER_ADDRESS="${salaryAddress}"`)
  console.log(`  EMPLOYMENT_VERIFIER_ADDRESS="${empAddress}"`)
  console.log(`  BOUNTY_REGISTRY_ADDRESS="${bountyAddress}"`)
  if (polygonscanBase !== 'local') {
    console.log(`\n  View on explorer: ${polygonscanBase}/${registryAddress}`)
  }
  if (isMainnet) {
    console.log('\n  NEXT: Transfer DIDRegistry ownership to Gnosis Safe multisig:')
    console.log('  npx hardhat run scripts/transfer-ownership.ts --network polygon')
  }
  console.log('══════════════════════════════════════════════════\n')
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
