import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying TrustChain contracts with:', deployer.address)

  // BountyRegistry (fee recipient = deployer for now; change before mainnet)
  const BountyRegistry = await ethers.getContractFactory('BountyRegistry')
  const registry = await BountyRegistry.deploy(deployer.address)
  await registry.waitForDeployment()
  console.log('BountyRegistry deployed to:', await registry.getAddress())

  // ReferralEscrow is deployed per-referral by BountyRegistry.createEscrow()
  // No direct deployment needed here.

  console.log('\nNOTE: Submit to Certik audit before Polygon mainnet deployment.')
}

main().catch(err => { console.error(err); process.exit(1) })
